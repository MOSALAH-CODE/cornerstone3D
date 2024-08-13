import type { Point2, Point3, PointsXYZ } from '../types';
export declare type PolyDataPointConfiguration = {
    dimensions?: number;
    initialSize?: number;
    growSize?: number;
};
export default class PointsManager<T> {
    kIndex: number;
    sources: PointsManager<T>[];
    data: Float32Array;
    _dimensions: number;
    _length: number;
    _byteSize: number;
    growSize: number;
    array: ArrayBuffer;
    constructor(configuration?: PolyDataPointConfiguration);
    forEach(func: (value: T, index: number) => void): void;
    get length(): number;
    get dimensions(): number;
    get dimensionLength(): number;
    getPoint(index: number): T;
    getPointArray(index: number): T;
    protected grow(additionalSize?: number, growSize?: number): void;
    reverse(): void;
    push(point: T): void;
    map<R>(f: (value: any, index: number) => R): R[];
    get points(): T[];
    toXYZ(): PointsXYZ;
    static fromXYZ({ x, y, z }: PointsXYZ): PointsManager<Point3>;
    subselect(count?: number, offset?: number): PointsManager<T>;
    static create3(initialSize?: number): PointsManager<Point3>;
    static create2(initialSize?: number): PointsManager<Point2>;
}
