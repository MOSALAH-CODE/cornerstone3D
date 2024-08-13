import { PixelDataTypedArray } from '../types';
export declare type RLERun<T> = {
    value: T;
    start: number;
    end: number;
};
export default class RLEVoxelMap<T> {
    protected rows: Map<number, RLERun<T>[]>;
    protected height: number;
    protected width: number;
    protected depth: number;
    protected jMultiple: number;
    protected kMultiple: number;
    protected numComps: number;
    defaultValue: T;
    pixelDataConstructor: Uint8ArrayConstructor;
    constructor(width: number, height: number, depth?: number);
    get: (index: number) => T;
    protected getRLE(i: number, j: number, k?: number): RLERun<T>;
    protected findIndex(row: RLERun<T>[], i: number): number;
    getRun: (j: number, k: number) => RLERun<T>[];
    set: (index: number, value: T) => void;
    clear(): void;
    keys(): number[];
    getPixelData(k?: number, pixelData?: PixelDataTypedArray): PixelDataTypedArray;
}
//# sourceMappingURL=RLEVoxelMap.d.ts.map