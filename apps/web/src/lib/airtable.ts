import "server-only";
import Airtable from "airtable";
import { env } from "../env.mjs";

let airtableInstance: Airtable | null = null;

export function getAirtable() {
  if (!airtableInstance) {
    airtableInstance = new Airtable({ apiKey: env.AIRTABLE_API_KEY });
  }
  return airtableInstance;
}

export function getLeadsTable() {
  const airtable = getAirtable();
  return airtable.base(env.AIRTABLE_BASE_ID)(env.AIRTABLE_TABLE_NAME);
}
