import fs from "fs";
import crypto from "crypto";

export const calculateFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");

    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => {
      hash.update(chunk);
    });

    stream.on("end", () => {
      const fileHash = hash.digest("hex");
      resolve(fileHash);
    });

    stream.on("error", reject);
  });
};
