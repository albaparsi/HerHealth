import { Client } from "@elastic/elasticsearch";

export const INDEX = "women-health-sources";

export function elasticClient() {
  const node = process.env.ELASTIC_URL;
  const apiKey = process.env.ELASTIC_API_KEY;
  if (!node || !apiKey) {
    throw new Error("Set ELASTIC_URL and ELASTIC_API_KEY in .env.local (see .env.example).");
  }
  return new Client({ node, auth: { apiKey } });
}
