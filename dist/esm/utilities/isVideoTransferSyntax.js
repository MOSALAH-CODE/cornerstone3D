export const videoUIDs = new Set([
    '1.2.840.10008.1.2.4.100',
    '1.2.840.10008.1.2.4.100.1',
    '1.2.840.10008.1.2.4.101',
    '1.2.840.10008.1.2.4.101.1',
    '1.2.840.10008.1.2.4.102',
    '1.2.840.10008.1.2.4.102.1',
    '1.2.840.10008.1.2.4.103',
    '1.2.840.10008.1.2.4.103.1',
    '1.2.840.10008.1.2.4.104',
    '1.2.840.10008.1.2.4.104.1',
    '1.2.840.10008.1.2.4.105',
    '1.2.840.10008.1.2.4.105.1',
    '1.2.840.10008.1.2.4.106',
    '1.2.840.10008.1.2.4.106.1',
    '1.2.840.10008.1.2.4.107',
    '1.2.840.10008.1.2.4.108',
]);
export default function isVideoTransferSyntax(uidOrUids) {
    if (!uidOrUids) {
        return false;
    }
    const uids = Array.isArray(uidOrUids) ? uidOrUids : [uidOrUids];
    return uids.find((uid) => videoUIDs.has(uid));
}
//# sourceMappingURL=isVideoTransferSyntax.js.map