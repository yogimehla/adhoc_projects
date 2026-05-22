declare global {
  interface Window {
    externalMessage?: {
      send: (json: string) => void;
    };
    _externalMessageResult?: (result: any) => void;
  }
}
export {};
