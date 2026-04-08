require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.API_PORT || 3001;
app.use(cors());
app.use(express.json());
