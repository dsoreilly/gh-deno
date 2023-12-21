import { load } from "https://deno.land/std@0.209.0/dotenv/mod.ts";
import { Octokit } from "https://esm.sh/@octokit/core";

const env = await load();
const token = env["PERSONAL_ACCESS_TOKEN"];

const octokit = new Octokit({ auth: token });

const res = await octokit.graphql(`
  query {
    search(first:10, query:"deno in:topics", type:REPOSITORY) {
      nodes {
        ... on Repository {
          description
          nameWithOwner
        }
      }
    }
  }
`);

console.log(res);
