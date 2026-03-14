import Busboy from "busboy";

export function parseMultipartImageFiles(
  req,
  { fieldName = "photos", maxFiles = 6, maxFileSize = 8 * 1024 * 1024 } = {},
) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers["content-type"] || "");
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return reject(new Error("multipart_form_data_required"));
    }

    const files = [];
    let parseError = null;

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: maxFiles,
        fileSize: maxFileSize,
      },
    });

    busboy.on("file", (name, file, info) => {
      const { filename, mimeType } = info;

      if (name !== fieldName) {
        file.resume();
        return;
      }

      if (!String(mimeType || "").startsWith("image/")) {
        parseError = new Error("Only image files are allowed");
        file.resume();
        return;
      }

      const chunks = [];
      let size = 0;

      file.on("data", (chunk) => {
        size += chunk.length;
        chunks.push(chunk);
      });

      file.on("limit", () => {
        parseError = new Error("File too large");
      });

      file.on("end", () => {
        if (parseError) return;

        files.push({
          fieldname: name,
          originalname: filename || "photo",
          mimetype: mimeType || "application/octet-stream",
          buffer: Buffer.concat(chunks, size),
          size,
        });
      });
    });

    busboy.on("filesLimit", () => {
      parseError = new Error("Too many files");
    });

    busboy.on("error", reject);

    busboy.on("finish", () => {
      if (parseError) {
        reject(parseError);
        return;
      }
      resolve(files);
    });

    if (Buffer.isBuffer(req.rawBody)) {
      busboy.end(req.rawBody);
      return;
    }

    reject(new Error("raw_body_required"));
  });
}
