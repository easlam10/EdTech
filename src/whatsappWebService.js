// whatsappWebService.js
import pkg from "whatsapp-web.js";
const { Client, RemoteAuth } = pkg;
import { MongoStore } from "wwebjs-mongo";
import mongoose from "mongoose";
import qrcode from "qrcode-terminal";
import dotenv from "dotenv";

dotenv.config();

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.store = null;
  }

  async initialize() {
    try {
      // Connect to MongoDB where the session is saved
      console.log("Connecting to MongoDB...");
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Connected to MongoDB successfully!");

      // Create MongoDB store with the same configuration as original app
      this.store = new MongoStore({ mongoose });

      // Create WhatsApp client with RemoteAuth to use existing session
      this.client = new Client({
        authStrategy: new RemoteAuth({
          store: this.store,
          backupSyncIntervalMs: 300000,
          clientId: "app2", // Use the same clientId as the original app
        }),
        puppeteer: {
          args: ["--no-sandbox"],
          headless: true,
        },
      });

      // In case session doesn't exist, handle QR code event
      this.client.on("qr", (qr) => {
        console.log("No saved session found. Please scan this QR code:");
        qrcode.generate(qr, { small: true });
      });

      // When client is ready
      this.client.on("ready", () => {
        this.isReady = true;
        console.log("Client is ready! Session loaded from MongoDB.");
      });

      this.client.on("authenticated", () => {
        console.log("Authentication successful!");
      });

      this.client.on("remote_session_saved", () => {
        console.log("Session saved to MongoDB!");
      });

      // Initialize the client
      console.log("Initializing WhatsApp client with saved session...");
      await this.client.initialize();

      return this;
    } catch (error) {
      console.error("Error initializing WhatsApp client:", error);
      throw error;
    }
  }

  async sendMessage(to, message) {
    try {
      if (!this.isReady) {
        console.log("WhatsApp client not ready. Waiting for initialization...");
        await this.waitForReady();
      }

      // Format number for WhatsApp
      const formattedNumber = this.formatPhoneNumber(to);
      const chatId = `${formattedNumber}@c.us`;

      // Send the message
      console.log(`Sending message to ${to}...`);
      const response = await this.client.sendMessage(chatId, message);
      console.log(`Message sent to ${to}: ${response.id._serialized}`);
      return response;
    } catch (error) {
      console.error(`Failed to send message to ${to}:`, error);
      throw error;
    }
  }

  // Format phone number to WhatsApp format
  formatPhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    return phoneNumber.replace(/\D/g, "");
  }

  // Wait for client to be ready with timeout
  async waitForReady(timeoutMs = 60000) {
    if (this.isReady) return true;

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.isReady) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(true);
        }
      }, 1000);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        reject(
          new Error(
            `Timed out waiting for WhatsApp client to be ready after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);
    });
  }
}

// Create and initialize the service
const whatsappWebService = new WhatsAppService();

export default whatsappWebService;
