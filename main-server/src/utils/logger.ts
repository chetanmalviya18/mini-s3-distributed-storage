type Log = {
  message: string;
  time: string;
};

let logs: Log[] = [];

export const addLog = (message: string) => {
  logs.push({
    message,
    time: new Date().toLocaleTimeString(),
  });

  // keep only last 50 logs
  if (logs.length > 50) logs.shift();
};

export const getLogs = () => logs;
