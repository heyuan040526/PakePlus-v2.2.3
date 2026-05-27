# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based batch image generation tool for Amazon product listings. It's a single-page application that helps users:
1. Extract product features from images and text using AI
2. Generate image prompts for Amazon main images and A+ content
3. Generate product images using AI image generation APIs

The application runs entirely in the browser with no backend server required (except for a simple static file server for local development).

## Architecture

### Core Components

**Frontend Stack:**
- Pure HTML/CSS/JavaScript (no frameworks)
- Single-page application with modal-based UI
- LocalStorage for settings persistence

**Main Files:**
- `index.html` - Main UI structure with table layout and modal dialogs
- `script.js` - All application logic (~3200+ lines)
- `style.css` - Styling for table, modals, and UI components

**Key Data Flow:**
1. User uploads product image + enters selling points
2. "提取" (Extract) button → calls Image Recognition API (gpt-5.2) or Text Analysis API (Deepseek)
3. Extracted results enable "主图" (Main Image) and "A+" buttons
4. These buttons generate prompts using templates and AI
5. "生成" (Generate) button creates images using Image Generation API (gpt-image-2 or Gemini)

### State Management

The application uses several global state trackers:

- `rowExtractStatus` (Map) - Tracks extraction status per row (idle/extracting/completed/error)
- `promptGeneratingRows` (Set) - Tracks which rows are currently generating prompts
- `selectedRows` (Set) - Tracks selected rows for batch operations
- `aiSettings` (Object) - Stores all API configurations and templates in LocalStorage

### API Integration

The app integrates with three types of APIs:

1. **Image Recognition API** (gpt-5.2) - Analyzes product images with selling points
2. **Text Analysis API** (Deepseek) - Analyzes text-only selling points
3. **Image Generation APIs**:
   - gpt-image-2 (default)
   - gemini-3.1-flash-image-preview (alternative)

All API settings are stored in LocalStorage under the key `aiSettings`.

### Prompt Generation System

Two modes for generating image prompts:

**Amazon Mode:**
- Uses predefined templates (`mainImageTemplate`, `aplusTemplate`)
- Templates use placeholders: `{product_name}` and `{extract_result}`
- Automatically sets aspect ratios (主图=1:1, A+=21:9)
- Generates multiple prompts (12 for main images, 8 for A+)

**Free Mode:**
- User manually inputs prompt text
- No template processing
- Direct input to image generation

### Row Lifecycle

Each table row goes through these states:

1. **Initial** - Empty row with disabled buttons
2. **Extraction** - User uploads image/enters text, clicks "提取"
3. **Extracted** - Results displayed, "主图" and "A+" buttons enabled
4. **Prompt Generated** - Prompts created, ready for image generation
5. **Image Generated** - Result image displayed in "结果图片" column

Button states are controlled by:
- Extract completion status (`rowExtractStatus`)
- Prompt generation status (`promptGeneratingRows`)
- MutationObserver watching extract display changes

## Development

### Running Locally

This is a pure frontend application — just open `index.html` directly in a browser, or use any static file server (e.g. VS Code Live Server, `npx serve`, `python -m http.server`).

### Settings UI

Press `J` key to open settings modal with two tabs:
- **API设置** - Configure API keys and endpoints
- **模板设置** - Edit prompt templates

## Key Functions

### Extraction Functions

- `extractWithAI(rowId)` - Main extraction entry point, routes to image or text API
- `extractWithImageAPI()` - Calls gpt-5.2 for image+text analysis
- `extractWithTextAPI()` - Calls Deepseek for text-only analysis
- `analyzePromptsWithAI(text)` - Parses AI response into structured prompts

### Prompt Generation Functions

- `generatePrompts(rowId, type)` - Generates prompts for 'main' or 'aplus'
- `extractProductName(extractResult)` - Extracts product name from extraction results
- Template processing replaces `{product_name}` and `{extract_result}` placeholders

### Image Generation Functions

- `generateImage(rowId)` - Main image generation entry point
- `generateWithGPTImage()` - Calls gpt-image-2 API
- `generateWithGemini()` - Calls Gemini API
- Supports custom aspect ratios and model selection

### UI Functions

- `addNewRow()` - Creates new table row with all event listeners
- `showImageModal(src)` - Displays full-size image preview
- `showExtractEditModal(row)` - Opens extraction result editor
- `updateSelectionUI()` - Updates batch selection toolbar

## Important Patterns

### Button State Management

Buttons are enabled/disabled based on extraction status:

```javascript
// Buttons disabled until extraction completes
if (status === EXTRACT_STATUS.COMPLETED && !promptGeneratingRows.has(rowId)) {
    mainImageBtn.disabled = false;
    aplusBtn.disabled = false;
}
```

### Mode Toggle System

Each row has a mode toggle (Amazon/Free):
- Amazon mode: Uses templates, shows "主图"/"A+" buttons
- Free mode: Shows textarea for manual prompt input

Mode is stored in `data-mode` attribute on `.prompt-mode-toggle` element.

### Prompt Storage

Generated prompts are stored in the DOM:
- Displayed in expandable rows below the main row
- Stored as `promptsData` property on expand button element
- Each prompt has title and content fields

## Common Tasks

### Adding a New Button to a Row

1. Add button HTML in `addNewRow()` function (around line 350-400)
2. Query the button element after row creation
3. Add event listener with row-specific logic
4. Update button state based on extraction/generation status

### Modifying API Calls

All API calls follow this pattern:
```javascript
const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
});
```

API settings are read from `aiSettings` object.

### Adding New Templates

1. Add template field to `aiSettings` default object (around line 54-200)
2. Add textarea in settings modal (`index.html` template section)
3. Load template value in `loadAISettings()` function
4. Save template value in save settings handler
5. Use template in prompt generation with placeholder replacement

## File Structure Notes

- No build process required - direct browser execution
- All dependencies are vanilla JavaScript
- Settings persist across sessions via LocalStorage
- Images are handled as base64 data URLs for upload
- Download functionality uses browser's native download API
