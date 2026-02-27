declare module 'node-notifier' {
  interface NotificationOptions {
    title?: string;
    message?: string;
    appID?: string;
  }
  const notifier: {
    notify(options: NotificationOptions, callback?: (err: Error | null, response: string) => void): void;
  };
  export default notifier;
}
