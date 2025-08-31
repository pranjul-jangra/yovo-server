import jwt from "jsonwebtoken";
import { UAParser } from 'ua-parser-js';
import axios from 'axios';


// Generate access and refresh tokens
export const generateTokens = (id) => {
  try {
    if (!id) return { accessToken: null, refreshToken: null, error: "Username and email are required" };

    // Generate tokens
    const accessToken = jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "15d" });

    return { accessToken, refreshToken, error: null };

  } catch (error) {
    return { accessToken: null, refreshToken: null, error: "Error generating tokens" };
  }
}

// Refresh access token
export const regenerateAccessToken = (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const accessToken = jwt.sign({ id: decoded.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });

    return { accessToken };

  } catch (error) {
    console.error("Error refreshing token:", error);
    return { accessToken: null };
  }
}

// Verify access token
export const verifyAccessToken = async (token) => {
  try {
    const decoded = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Verify refresh token
export const verifyRefreshToken = async (token) => {
  try {
    const decoded = await jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Get device information from user agent
export const getDeviceInfo = (userAgent) => {
  
  const parser = new UAParser(userAgent);
  const { browser, os, device } = parser.getResult();

  return {
    vendor: device.vendor || 'Unknown',
    model: device.model || 'Unknown',
    os: `${os.name || 'Unknown'} ${os.version || ''}`.trim(),
    browser: `${browser.name || 'Unknown'} ${browser.version || ''}`.trim(),
  };
};

// Get location information based on IP address
export const getLocationInfo = async (ip) => {
  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);

    const { city, region, country_name: country } = response.data;
    return { city, region, country, ip };

  } catch {
    return { city: 'Unknown', region: 'Unknown', country: 'Unknown', ip };
  }
};