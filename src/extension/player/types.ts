import { GetDataType, ProtocolMap } from "webext-bridge";

export type PortMessage<T, K extends string = string> = {
  type: K,
  data: T,
  id: number,
};

export type Messages = {
  [K in keyof ProtocolMap]: PortMessage<GetDataType<K, null>, K>
}[keyof ProtocolMap];