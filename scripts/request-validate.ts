import { detectSnapLocation, fetchSnap } from '@metamask/snaps-controllers';
import type { InitialPermissions, SnapId } from '@metamask/snaps-sdk';
import type { SnapManifest } from '@metamask/snaps-utils';
import type { SemVerRange } from '@metamask/utils';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import type { SnapsRegistryDatabase } from '../src';

const DEFAULT_REGISTRY_PATH = resolve(__dirname, '..', 'src', 'registry.json');

type PermissionKey = keyof InitialPermissions | string;
const ALLOWED_PERMISSIONS: PermissionKey[] = [
  'endowment:cronjob',
  'endowment:ethereum-provider',
  'endowment:lifecycle-hooks',
  'endowment:name-lookup',
  'endowment:network-access',
  'endowment:page-home',
  'endowment:rpc',
  'endowment:signature-insight',
  'endowment:transaction-insight',
  'endowment:webassembly',
  'snap_dialog',
  'snap_getLocale',
  'snap_manageState',
  'snap_notify',
];

/**
 * Fetch a Snap from the registry.
 *
 * @param snapId - The ID of the Snap to fetch.
 * @param version - The version of the Snap to fetch.
 * @returns The Snap.
 */
export async function getSnap(
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
 * Check if a Snap is already in the registry.
 *
 * @param snapId - The ID of the Snap to check.
 */
async function checkRegistry(snapId: SnapId) {
  const registryJson = await fs.readFile(DEFAULT_REGISTRY_PATH);
  const registry = JSON.parse(registryJson.toString()) as SnapsRegistryDatabase;

  if (registry.verifiedSnaps[snapId]) {
    throw new Error(
      `Snap "${snapId}" is already in the registry. Please update the Snap instead.`,
    );
  }
}

/**
 * Verify a Snap manifest. This script checks the permissions of a Snap, to
 * ensure that it only requests permissions that are allowed.
 *
 * @param manifest - The Snap manifest to verify.
 * @param manifest.initialPermissions - The initial permissions of the Snap.
 * @throws An error if the Snap manifest is invalid.
 */
async function checkPermissions({ initialPermissions }: SnapManifest) {
  const permissions = Object.keys(initialPermissions);

  for (const permission of permissions) {
    if (!ALLOWED_PERMISSIONS.includes(permission)) {
      throw new Error(
        `Permission "${permission}" is not allowed. Only the following permissions are allowed: ${ALLOWED_PERMISSIONS.join(
          ', ',
        )}.`,
      );
    }
  }
}

/**
 * Verify a Snap for addition to the registry. This script checks:
 *
 * - If the Snap is already in the registry (in which case it should be updated
 * instead).
 * - The permissions of the Snap, to ensure that it only requests permissions
 * that are allowed.
 */
async function main() {
  const { _: argv, version } = await yargs(hideBin(process.argv))
    .version(false)
    .demandCommand(1, 1, 'Please provide a Snap ID.')
    .option('version', {
      description:
        'The version of the Snap to verify. Defaults to the latest version.',
      type: 'string',
    })
    .parseAsync();

  const snapId = argv[0] as SnapId;
  const snap = await getSnap(snapId, version as SemVerRange);

  await checkRegistry(snapId);
  await checkPermissions(snap.manifest.result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
