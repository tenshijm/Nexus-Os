declare module "@dylankenneally/react-native-ssh-sftp" {
  export default class SSHClient {
    static connectWithPassword(
      host: string,
      port: number,
      username: string,
      password: string,
    ): Promise<SSHClient>;
    on(event: "Shell", callback: (data: string) => void): void;
    startShell(ptyType: string): Promise<void>;
    writeToShell(command: string): Promise<void>;
    closeShell(): Promise<void>;
    disconnect(): Promise<void>;
  }
}
