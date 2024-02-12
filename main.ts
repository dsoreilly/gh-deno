import { FILEPATH_DATA, FILEPATH_DATA_CACHE } from "@/lib/constants.ts";
import { queryGithubGraphqlApi } from "@/services/github_graphql_api.ts";

/**
 * Queries the data cache to determine whether or not it has expired. If the
 * cache is older than 1 hour or it is invalid, the cache has expired.
 */

async function hasCacheExpired() {
  try {
    const timestamp = await Deno.readTextFile(FILEPATH_DATA_CACHE);
    return parseInt(timestamp, 10) + 60 * 60 * 60 < new Date().getTime();
  } catch (error) {
    console.error(error.message);
    return true;
  }
}

if (await hasCacheExpired()) {
  await queryGithubGraphqlApi();
}

try {
  const data = await Deno.readTextFile(FILEPATH_DATA);
  console.debug(data);
} catch (error) {
  console.error(error.message);
}
