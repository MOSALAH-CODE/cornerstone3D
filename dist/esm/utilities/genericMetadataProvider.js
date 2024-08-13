import { addProvider } from '../metaData';
let state = {};
const metadataProvider = {
    add: (imageId, payload) => {
        const type = payload.type;
        if (!state[imageId]) {
            state[imageId] = {};
        }
        state[imageId][type] =
            payload.rawMetadata ?? structuredClone(payload.metadata);
    },
    get: (type, imageId) => {
        return state[imageId]?.[type];
    },
    clear: () => {
        state = {};
    },
};
addProvider(metadataProvider.get);
export default metadataProvider;
//# sourceMappingURL=genericMetadataProvider.js.map