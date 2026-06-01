/** Web stub ÔÇö native SSH is Android/iOS only (dev build required). */
export type NativeSshClient = {
  on(event: string, cb: (data: string) => void): void;
  startShell(ptyType: string): Promise<void>;
  writeToShell(data: string): Promise<void>;
  closeShell(): Promise<void>;
  disconnect(): Promise<void>;
};

const SSHClient = {
  connectWithPassword: async (): Promise<NativeSshClient> => {
    throw new Error("Native SSH is not available on web");
  },
};

export default SSHClient;
