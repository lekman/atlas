/**
 * Manages machine tokens on the Mac mini. Run it beside the server, against
 * the same database:
 *
 *   bun apps/server/src/machine-tokens.ts list
 *   bun apps/server/src/machine-tokens.ts issue <id> --node <tailnet name or address> --clients <id,id | *>
 *   bun apps/server/src/machine-tokens.ts revoke <id>
 *
 * `issue` prints the token once. Store it in the machine's Keychain; it is
 * not kept anywhere else. Issuing again for the same id replaces the token,
 * which is how a token is rotated.
 */
import { readConfiguration } from "./configuration";
import { openDatabase } from "./database";
import { tailscaleNodeLookup } from "./identity";
import { issueMachineToken, listMachines, revokeMachine } from "./machines";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** A tailnet name becomes its address through `tailscale ip`, then its node through `whois`. */
async function nodeOf(target: string): Promise<string> {
  let address = target;
  if (!/^[\d.]+$|:/.test(target)) {
    const process = Bun.spawn(["tailscale", "ip", "-4", target], {
      stdout: "pipe",
      stderr: "ignore",
    });
    address = (await new Response(process.stdout).text()).trim();
    if ((await process.exited) !== 0 || !address)
      throw new Error(`tailscale does not know ${target}`);
  }
  const node = await tailscaleNodeLookup()(address);
  if (!node) throw new Error(`tailscale whois found no node for ${address}`);
  return node;
}

const [command, id] = process.argv.slice(2);
const database = openDatabase(readConfiguration().databasePath);

switch (command) {
  case "list":
    for (const machine of listMachines(database))
      console.log(
        `${machine.id}\t${machine.nodeStableId}\t${machine.clients.join(",")}\tissued ${machine.issuedAt}${machine.revokedAt ? `\trevoked ${machine.revokedAt}` : ""}`,
      );
    break;
  case "issue": {
    const node = option("--node");
    const clients = option("--clients");
    if (!id || !node || !clients)
      throw new Error(
        "issue <id> --node <tailnet name or address> --clients <ids | *>",
      );
    const token = issueMachineToken(database, {
      id,
      nodeStableId: await nodeOf(node),
      clients: clients.split(",").map((client) => client.trim()),
    });
    console.log(token);
    break;
  }
  case "revoke":
    if (!id) throw new Error("revoke <id>");
    console.log(
      revokeMachine(database, id) ? `revoked ${id}` : `no machine ${id}`,
    );
    break;
  default:
    console.log(
      "usage: machine-tokens.ts list | issue <id> --node <name> --clients <ids | *> | revoke <id>",
    );
}

database.$client.close();
