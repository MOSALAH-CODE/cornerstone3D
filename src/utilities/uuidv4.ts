import { v4 as uuidv4Fallback } from 'uuid';


/**
 * Generates a unique id that has limited chance of collision
 *
 * @see {@link https://stackoverflow.com/a/2117523/1867984|StackOverflow: Source}
 * @returns a v4 compliant GUID
 */

export default function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    return uuidv4Fallback(); // Fallback to 'uuid' library if crypto.randomUUID is not available
  }
}
