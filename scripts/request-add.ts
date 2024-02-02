import { detectSnapLocation, fetchSnap } from '@metamask/snaps-controllers';
import type { SnapId } from '@metamask/snaps-sdk';
import type { SemVerRange } from '@metamask/utils';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { format } from 'prettier';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import type { SnapsRegistryDatabase, VerifiedSnap } from '../src';

const DEFAULT_REGISTRY_PATH = resolve(__dirname, '..', 'src', 'registry.json');

/**
 * Fetch a Snap from the registry.
 *
 * @param snapId - The ID of the Snap to fetch.
 * @param version - The version of the Snap to fetch.
 * @returns The Snap.
 */
async function getSnap(
  snapId: SnapId,
  version: SemVerRange = '*' as SemVerRange,
) {
  try {
    return await fetchSnap(
      snapId,
      detectSnapLocation(snapId, { versionRange: version }),
    );
  } catch (error) {
    throw new Error(
      `Unable to fetch Snap "${snapId}@${version}". Please check the Snap ID and version and try again.`,
    );
  }
}

/**
 * Add a Snap to the registry.
 */
async function main() {
  const registryJson = await fs.readFile(DEFAULT_REGISTRY_PATH);
  const registry = JSON.parse(registryJson.toString()) as SnapsRegistryDatabase;

  const { _: argv, version } = await yargs(hideBin(process.argv))
    .version(false)
    .demandCommand(1, 1, 'Please provide a Snap ID.')
    .option('version', {
      description:
        'The version of the Snap to add. Defaults to the latest version.',
      type: 'string',
    })
    .parseAsync();

  const snapId = argv[0] as SnapId;
  const snap = await getSnap(snapId, version as SemVerRange);
  const verifiedSnap: VerifiedSnap = {
    id: snapId,
    metadata: {
      name: snap.manifest.result.proposedName,
    },
    versions: {
      [snap.manifest.result.version]: {
        checksum: snap.manifest.result.source.shasum,
      },
    },
  };

  const unsortedSnaps: [string, VerifiedSnap][] = [
    ...Object.entries(registry.verifiedSnaps),
    [snapId, verifiedSnap],
  ];

  const verifiedSnaps = Object.fromEntries(
    unsortedSnaps.sort(([a], [b]) => a.localeCompare(b)),
  );

  const newRegistry = {
    verifiedSnaps,
    blockedSnaps: registry.blockedSnaps,
  };

  await fs.writeFile(
    DEFAULT_REGISTRY_PATH,
    format(JSON.stringify(newRegistry, null, 2), {
      parser: 'json',
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
