import { TerminalToolClient } from "./TerminalToolClient.js";

export function getTerminalClient(): TerminalToolClient {
    return new TerminalToolClient();
}