import { ContextManager } from "./ContextManager.js";

export type SpecialContext = {
  type: string;
};

export type SpecialInstructions = {
  type: string;
};

export type Task = object;

export interface ContextConverter<T> {
  convert(context: ContextManager): Promise<T>;
}
