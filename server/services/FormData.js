// server/services/FormData.js
// Polyfill cho FormData trong Node.js environment
const fs = require('fs');
const { Readable } = require('stream');
const path = require('path');
const mime = require('mime-types');

class FormData {
  constructor() {
    this.boundary = `----FormBoundary${Math.random().toString(16).substr(2)}`;
    this.buffers = [];
    this.headers = {};
  }

  append(name, value, options = {}) {
    const buffer = [];
    buffer.push(`--${this.boundary}\r\n`);
    
    let header = `Content-Disposition: form-data; name="${name}"`;
    
    if (options.filename) {
      header += `; filename="${options.filename}"`;
      buffer.push(`${header}\r\n`);
      
      if (options.contentType) {
        buffer.push(`Content-Type: ${options.contentType}\r\n`);
      } else if (options.filename) {
        const mimeType = mime.lookup(options.filename) || 'application/octet-stream';
        buffer.push(`Content-Type: ${mimeType}\r\n`);
      }
    } else {
      buffer.push(`${header}\r\n`);
    }
    
    buffer.push('\r\n');
    
    if (Buffer.isBuffer(value)) {
      this.buffers.push(Buffer.from(buffer.join('')));
      this.buffers.push(value);
      this.buffers.push(Buffer.from('\r\n'));
    } else if (value instanceof Readable) {
      // Chuyển đổi stream thành buffer
      const chunks = [];
      value.on('data', chunk => chunks.push(chunk));
      value.on('end', () => {
        const valueBuffer = Buffer.concat(chunks);
        this.buffers.push(Buffer.from(buffer.join('')));
        this.buffers.push(valueBuffer);
        this.buffers.push(Buffer.from('\r\n'));
      });
    } else {
      buffer.push(value);
      buffer.push('\r\n');
      this.buffers.push(Buffer.from(buffer.join('')));
    }
  }

  getBuffer() {
    const endBuffer = Buffer.from(`--${this.boundary}--\r\n`);
    return Buffer.concat([...this.buffers, endBuffer]);
  }

  getHeaders() {
    return {
      'Content-Type': `multipart/form-data; boundary=${this.boundary}`
    };
  }
}

module.exports = FormData;
