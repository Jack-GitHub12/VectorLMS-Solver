# VectorLMS Solver Extension

<div align="center">
  <img src="icon.svg" width="128" height="128" alt="VectorLMS Solver">
  
  # 🚀 VectorLMS Solver
  
  **Automate your Vector LMS training completion**
  
  [![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Jack-GitHub12/VectorLMS-Solver)
  [![Chrome](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com)
  [![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)
</div>

---

## 🎯 Overview

VectorLMS Solver is a powerful Chrome extension that automates the completion of Vector LMS training courses. It intelligently navigates through course content, handles interactive elements, and ensures all required activities are completed efficiently.

## ✨ Features

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

## 📦 Installation

### Method 1: Load from Source
1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/Jack-GitHub12/VectorLMS-Solver.git
   ```
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** using the toggle in the top-right corner
4. **Click "Load unpacked"** and select the `vector` folder
5. **Pin the extension** to your toolbar for easy access

### Method 2: Quick Install
1. Download the latest release from [GitHub Releases](https://github.com/Jack-GitHub12/VectorLMS-Solver/releases)
2. Extract the ZIP file
3. Follow steps 2-5 from Method 1

## 🚀 Usage

### Getting Started
1. Navigate to your Vector LMS course page
2. The extension will automatically:
   - Detect course tasks and build a queue
   - Navigate through each task
   - Complete videos, slides, and interactive content
   - Advance to the next task automatically

### 🎮 Control Interface

<img src="https://via.placeholder.com/360x480" alt="Extension Interface" width="360">

Click the extension icon in your toolbar to access:

| Feature | Description |
|---------|-------------|
| **Enable/Disable** | Toggle the automation on/off |
| **Progress Tracking** | View real-time completion status |
| **Queue Management** | Clear and reset task queue |
| **Refresh** | Update current status |

### 🧠 Smart Queue Management
The extension automatically:
- **Starts from the last task** in your course list (most recent/next to complete)
- **Detects completion status** for progress tracking and display
- **Maintains queue position** when navigating between pages
- **Processes all content types** seamlessly (videos, slides, quizzes, etc.)

### ⚡ Dynamic Content Handling
The extension intelligently adapts to varying content:
- **Variable element counts** - Handles any number of tabs, cards, dropdowns, or links
- **Multiple videos** - Processes multiple videos in sequence within a single task
- **Comprehensive detection** - Scans up to 50 numbered elements and stops when no more are found
- **Multi-pass processing** - Makes up to 3 attempts to ensure all interactive content is handled

## 📚 Supported Content Types

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

## 🛡️ Safety Features

- ⏸️ **User control**: Can be enabled/disabled anytime
- 🔄 **Error handling**: Graceful fallbacks for failed operations
- ⏱️ **Rate limiting**: Built-in delays to prevent overloading
- 🚫 **Domain restriction**: Only works on Vector LMS domains

## 🔧 Troubleshooting

**Extension not working?**
- Make sure you're on a vectorlmsedu.com or trainingcdn.com domain
- Check that the extension is enabled (green status in popup)
- Try refreshing the page
- Clear the queue and restart if stuck

**Can't click elements?**
- Some content may be in protected iframes
- Try manually clicking once, then let the extension continue
- Check browser console for detailed logs

## 🌐 Browser Support

- ✅ **Chrome** (Manifest V3)
- ✅ **Edge** (Chromium-based)
- ❌ Firefox (requires Manifest V2 conversion)

## 📝 Version History

- **v1.0.0** - Rebrand to VectorLMS Solver, UI refresh, metadata updates, stability improvements
- **v0.8** - Enhanced survey automation with table-based rating scales, neutral column selection, and multi-section survey navigation
- **v0.7** - Added survey/completion flow handling to automatically answer feedback questions and return to course menu
- **v0.6** - Enhanced dynamic content detection, multiple video handling, and adaptive element counting
- **v0.5** - Added dropdown/accordion interactions and interactive link clicking
- **v0.4** - Added card flipping functionality for interactive learning activities
- **v0.3** - Added Q&A brute force functionality, enhanced text-based element detection
- **v0.2** - Added popup interface, user controls, enhanced error handling, smart TOC scraping
- **v0.1** - Initial auto-completion functionality

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

**Important**: This extension is designed for educational and training efficiency purposes. Users must:
- Ensure compliance with their organization's policies regarding automated tools
- Use this tool responsibly and ethically
- Verify that automation is permitted for their specific training requirements

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on [GitHub Issues](https://github.com/Jack-GitHub12/VectorLMS-Solver/issues)
- Check the [Wiki](https://github.com/Jack-GitHub12/VectorLMS-Solver/wiki) for additional documentation

---

<div align="center">
  Made with ❤️ for efficient learning
  
  ⭐ Star this repo if you find it helpful!
</div>
