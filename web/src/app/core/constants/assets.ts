import { AssetType } from '../models';

export const ASSET_TYPES: ReadonlyArray<AssetType> = [
  'Plant & Machinery',
  'Land',
  'Building',
  'Leasehold Assets',
  'Furniture & Fixtures',
  'Vehicles',
  'Computer Equipment'
];

/** Land does not depreciate. */
export function isDepreciable(type: AssetType): boolean {
  return type !== 'Land';
}
