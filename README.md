# Smart Tab Grouper AI

Automatically group your opened tabs using OpenRouter AI models.

## Features

- 🤖 **AI-Powered Grouping** — Uses OpenRouter AI models to intelligently categorize your tabs
- 🔍 **Preview Before Applying** — See the suggested groupings before committing
- 📁 **Existing Group Detection** — Automatically assigns tabs to existing groups when relevant
- 🌐 **Bilingual UI** — Full support for English and Persian (Farsi)
- 💾 **Auto Backup** — Optional JSON backup of tabs before grouping
- ⚙️ **Flexible Configuration** — Customizable model selection, tab limits, and more

## Installation

### From Firefox Add-ons (AMO)
1. Visit the [Firefox Add-ons page](#) (coming soon)
2. Click "Add to Firefox"

### Manual Installation (Development)
1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from the project directory

## Usage

1. Click the extension icon in the toolbar
2. (Optional) Click "⚙️ Settings" to configure:
   - **Base URL** — OpenRouter API endpoint (default: `https://openrouter.ai/api/v1`)
   - **API Key** — Your OpenRouter API key
   - **Model** — Choose from supported AI models or enter a custom one
   - **Tab Limit** — Limit the number of tabs to process
   - **Auto Backup** — Toggle automatic backup before grouping
3. Click "🔍 Analyze & Preview" to get AI-suggested groupings
4. Review the preview and click "✅ Apply Grouping" to organize your tabs

## Prerequisites

- An [OpenRouter](https://openrouter.ai) account with an API key
- Firefox browser (version 109+)

## Privacy

This extension sends tab URLs and titles to the OpenRouter AI API for processing. No data is stored on external servers beyond what is required for the AI analysis. Your API key is stored locally in your browser's storage.

## Development

```bash
git clone https://github.com/karimi-mohammad/smart-tab-grouper
cd smart-tab-grouper
```

Load the extension in Firefox via `about:debugging#/runtime/this-firefox`.

## License

MIT

## Author

**Mohammad Karimi**

- GitHub: [karimi-mohammad](https://github.com/karimi-mohammad)