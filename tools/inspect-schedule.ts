import { schedules } from "@trigger.dev/sdk/v3";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const list = await schedules.list();
  console.log(JSON.stringify(list.data[0], null, 2));
}
main().catch(console.error);
