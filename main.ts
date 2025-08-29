import { graphql, GraphqlResponseError } from "https://esm.sh/@octokit/graphql";
import type { GraphQlQueryResponseData } from "https://esm.sh/@octokit/graphql";

/**
 * GraphQL API response data structure.
 */
interface ResponseData extends GraphQlQueryResponseData {
  topic: {
    repositories: {
      edges: {
        node: {
          description: string;
          languages: {
            edges: {
              node: {
                name: string;
              };
            }[];
          };
          nameWithOwner: string;
          stargazerCount: number;
        };
      }[];
    };
  };
}

/**
 * Path to the local GraphQL API response data file.
 */
const PATH_JSON = "graphql.json";

/**
 * Path to the GraphQL log file.
 */
const PATH_LOG = "graphql.log";

try {
  let mtime;

  try {
    ({ mtime } = await Deno.lstat(PATH_JSON));

    // Log the mtime of the local data file.
    await Deno.writeTextFile(
      PATH_LOG,
      `${new Date().toUTCString()}\ngraphql.json mtime ${mtime?.getTime()}\n`,
      { append: true },
    );
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
    console.warn("graphql.json not found.");
  }

  // If the data is more than 1 hour old, fetch fresh data from the API.
  if (!mtime || (Date.now() - mtime.getTime()) > 1000 * 60 * 60) {
    console.log("Fetching fresh data.");

    // Get the GitHub personal access token from the environment variables.
    const token = Deno.env.get("PERSONAL_ACCESS_TOKEN");
    if (!token) {
      throw new Error("Missing GitHub personal access token.");
    }

    try {
      // Fetch the GraphQL response data using the GitHub API.
      // https://docs.github.com/en/graphql/overview
      const responseData: ResponseData = await graphql({
        direction: "DESC",
        field: "STARGAZERS",
        headers: {
          authorization: `token ${token}`,
        },
        languageCount: 5,
        name: "deno",
        repoCount: 10,
        query: `
          query($direction: OrderDirection!, $field: RepositoryOrderField!, $languageCount: Int!, $name: String!, $repoCount: Int! ) {
            topic(name: $name) {
              repositories(first: $repoCount, orderBy: { field: $field, direction: $direction }) {
                edges {
                  node {
                    description
                    languages(first: $languageCount) {
                      edges {
                        node {
                          name
                        }
                      }
                    }
                    nameWithOwner
                    stargazerCount
                  }
                }
              }
            }
          }
        `,
      });

      // Write the response data to the local file.
      await Deno.writeTextFile(
        PATH_JSON,
        JSON.stringify(responseData, null, 2),
      );
    } catch (error) {
      if (error instanceof GraphqlResponseError) {
        // Log the error.
        const { name, message } = error;
        await Deno.writeTextFile(
          PATH_LOG,
          `${new Date().toUTCString()}\n${name}\n${message}\n`,
          { append: true },
        );
      }
      throw error;
    }
  }

  // Read the local data file and print the repository information.
  const data: ResponseData = JSON.parse(await Deno.readTextFile(PATH_JSON));
  data.topic.repositories.edges.forEach((edge) => {
    const { node } = edge;
    console.log(`${"-".repeat(87)}`);
    console.log(`Repo | ${node.nameWithOwner}`);
    console.log(
      `Desc | ${
        node.description.length >= 80
          ? node.description.slice(0, 76) + " ..."
          : node.description
      }`,
    );
    console.log(`Strs | ${node.stargazerCount.toLocaleString()}`);
  });

  Deno.exit(0);
} catch (error) {
  console.error("Error:", error);
  Deno.exit(1);
}
