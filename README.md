# VectorLMS Solver Extension

🚀 **Automate Vector LMS training completion** - Auto-advance slides, play videos, click tabs & complete tasks automatically.

## Features

✅ **Smart TOC scraping** - Intelligently detects Vector LMS course structure  
✅ **Auto-advance slides** via carousel controls and next buttons  
✅ **Multiple video handling** - Processes multiple videos in sequence automatically  
✅ **Dynamic content detection** - Adapts to varying numbers of interactive elements  
✅ **Dropdown/Accordion interactions** - Expands all accordion sections automatically  
✅ **Interactive link clicking** - Clicks links for tracking without navigation  
✅ **Card flipping** - Automatically flips all interactive cards before proceeding  
✅ **Q&A brute force** - Systematically tries all quiz answers until correct  
✅ **Tab navigation** - Clicks through SLIC tabs and page tabs  
✅ **Enhanced queue management** - Tracks videos, duration, and completion status  
✅ **Frame handling** - Works with embedded content and iframes  
✅ **User control** - Enable/disable via popup interface  
✅ **Detailed progress tracking** - Shows current task, video count, and time estimates  
✅ **Advanced survey automation** - Handles complex rating scales, neutral selections, and multi-section surveys  

## Installation

1. **Download/Clone** this extension folder to your computer
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

## Usage

### Automatic Mode
1. Navigate to your Vector LMS course page
2. The extension will automatically:
   - Detect course tasks and build a queue
   - Navigate through each task
   - Complete videos, slides, and interactive content
   - Advance to the next task automatically

### Control Interface
Click the extension icon in your toolbar to:
- **Enable/Disable** the auto-completion
- **View detailed progress** of current task queue with intelligent completion detection
- **Clear queue** if needed to reset
- **Refresh status** to update information

### Smart Queue Management
The extension automatically:
- **Starts from the last task** in your course list (most recent/next to complete)
- **Detects completion status** for progress tracking and display
- **Maintains queue position** when navigating between pages
- **Processes all content types** seamlessly (videos, slides, quizzes, etc.)

### Dynamic Content Handling
The extension intelligently adapts to varying content:
- **Variable element counts** - Handles any number of tabs, cards, dropdowns, or links
- **Multiple videos** - Processes multiple videos in sequence within a single task
- **Comprehensive detection** - Scans up to 50 numbered elements and stops when no more are found
- **Multi-pass processing** - Makes up to 3 attempts to ensure all interactive content is handled

## Supported Content Types

- 📽️ **Videos**: HTML5 video players and JWPlayer
- 🎯 **Slides**: Carousel controls and navigation buttons
- 📂 **Dropdowns/Accordions**: Expandable content sections and menus
- 🔗 **Interactive Links**: Clickable links for progress tracking
- 🃏 **Interactive Cards**: Flip cards and reveal activities
- 🧠 **Quizzes**: Multiple choice Q&A with automatic answer detection
- 📑 **Tabs**: SLIC framework tabs and standard page tabs
- 📚 **Tasks**: Course work links and training modules
- 🖼️ **Frames**: Embedded content and cross-origin iframes
- 📝 **Surveys/Completion**: Complex rating scales, multi-section surveys, and completion flows with neutral selections

## Safety Features

- ⏸️ **User control**: Can be enabled/disabled anytime
- 🔄 **Error handling**: Graceful fallbacks for failed operations
- ⏱️ **Rate limiting**: Built-in delays to prevent overloading
- 🚫 **Domain restriction**: Only works on Vector LMS domains

## Troubleshooting

**Extension not working?**
- Make sure you're on a vectorlmsedu.com or trainingcdn.com domain
- Check that the extension is enabled (green status in popup)
- Try refreshing the page
- Clear the queue and restart if stuck

**Can't click elements?**
- Some content may be in protected iframes
- Try manually clicking once, then let the extension continue
- Check browser console for detailed logs

## Browser Support

- ✅ **Chrome** (Manifest V3)
- ✅ **Edge** (Chromium-based)
- ❌ Firefox (requires Manifest V2 conversion)

## Version History

- **v1.0.0** - Rebrand to VectorLMS Solver, UI refresh, metadata updates, stability improvements
- **v0.8** - Enhanced survey automation with table-based rating scales, neutral column selection, and multi-section survey navigation
- **v0.7** - Added survey/completion flow handling to automatically answer feedback questions and return to course menu
- **v0.6** - Enhanced dynamic content detection, multiple video handling, and adaptive element counting
- **v0.5** - Added dropdown/accordion interactions and interactive link clicking
- **v0.4** - Added card flipping functionality for interactive learning activities
- **v0.3** - Added Q&A brute force functionality, enhanced text-based element detection
- **v0.2** - Added popup interface, user controls, enhanced error handling, smart TOC scraping
- **v0.1** - Initial auto-completion functionality

---

**Note**: This extension is for educational/training efficiency purposes. Always ensure compliance with your organization's policies regarding automated tools.
