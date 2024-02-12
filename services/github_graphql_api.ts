import { load } from "std/dotenv/mod.ts";
import { Octokit } from "https://esm.sh/@octokit/core";
import { GraphqlResponseError } from "https://esm.sh/@octokit/graphql";
import type {
  GraphQlEndpointOptions,
  GraphQlQueryResponseData,
} from "https://esm.sh/@octokit/graphql";
import { FILEPATH_DATA, FILEPATH_DATA_CACHE } from "@/lib/constants.ts";

let client: Octokit;
let responseData: GraphQlQueryResponseData;

/**
 * Gets an authenticated [Octokit](https://github.com/octokit/octokit.js#readme)
 * client using the GitHub Personsal Access Token provided in the dotenv
 * (`.env`) file.
 */

async function getAuthenticatedClient(): Promise<Octokit> {
  await load({ export: true });
  return new Octokit({ auth: Deno.env.get("PERSONAL_ACCESS_TOKEN") });
}

/**
 * Fetches the GraphQL query response data using the GitHub API with the an
 * authenticated Octokit client.
 */

async function fetchGraphQlQueryResponse(): Promise<GraphQlQueryResponseData> {
  return await client.graphql(
    `
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
    {
      direction: "DESC",
      field: "STARGAZERS",
      languageCount: 20,
      name: "deno",
      repoCount: 10,
    },
  );
}

type RequestLogEntry = {
  data?: GraphQlQueryResponseData;
  message: string;
  request?: GraphQlEndpointOptions;
};

/**
 * Logs the GraphQL request success or failure message with a datestamp. If
 * data and/or a request is provided, these are appended to the entry.
 */

async function logRequest(entry: RequestLogEntry) {
  const { data, message, request } = entry;

  let formattedEntry = new Date().toString() + "\n" + message + "\n";

  if (data) {
    formattedEntry += "Data:\n" + JSON.stringify(data) + "\n";
  }

  if (request) {
    formattedEntry += "Request:\n";
    Object.keys(request).forEach((key) => {
      formattedEntry += key + ": ";

      if (key === "variables") {
        Object.keys(request.variables).forEach((key) => {
          formattedEntry += key + ": " + request.variables[key] + "\n";
        });
      } else {
        formattedEntry += request[key] + "\n";
      }
    });
  }

  await Deno.writeTextFile("logs/request.log", formattedEntry, {
    append: true,
  });
}

/**
 * Caches the GraphQL response data by writing it to file and writing a cache
 * timestamp entry.
 */

async function cacheResponseData() {
  await Deno.writeTextFile(
    FILEPATH_DATA,
    JSON.stringify(responseData, null, 2),
  );
  await Deno.writeTextFile(
    FILEPATH_DATA_CACHE,
    new Date().getTime().toString(),
  );
}

export async function queryGithubGraphqlApi() {
  try {
    client = await getAuthenticatedClient();
    responseData = await fetchGraphQlQueryResponse();
    logRequest({ data: responseData, message: "Request made successfully." });

    await cacheResponseData();
  } catch (error) {
    console.error(error.message);

    if (error instanceof GraphqlResponseError) {
      logRequest(error);
    }
  }
}
