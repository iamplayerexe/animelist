<!-- <-- comment (.md file)(README.md) -->
<div align="center">

# Anime List 📺

</div>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="NodeJS"></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-26.6.10-%2347848F.svg?style=for-the-badge&logo=electron&logoColor=white" alt="Electron"></a>
  <a href="https://www.electronforge.io/"><img src="https://img.shields.io/badge/Electron%20Forge-7.8.0-%239B59B6.svg?style=for-the-badge&logo=electron&logoColor=white" alt="Electron Forge"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5"><img src="https://img.shields.io/badge/HTML5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/CSS"><img src="https://img.shields.io/badge/CSS3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript"><img src="https://img.shields.io/badge/JavaScript-%23F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"></a>
  <a href="https://www.npmjs.com/"><img src="https://img.shields.io/badge/NPM-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white" alt="NPM"></a>
  <a href="https://github.com/sindresorhus/electron-store"><img src="https://img.shields.io/badge/electron_store-7.0.3-blue?style=for-the-badge" alt="electron-store"></a>
  <a href="https://sweetalert2.github.io/"><img src="https://img.shields.io/badge/SweetAlert2-11.4.8-orange?style=for-the-badge" alt="SweetAlert2"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License: MIT"></a>
  <a href="https://github.com/iamplayerexe/animelist/releases"><img src="https://img.shields.io/github/v/release/iamplayerexe/animelist?style=for-the-badge" alt="Latest Release"></a>
</p>

> A simple, **offline-first** desktop application built with Electron for managing your personal anime watchlist without the fuss of complex websites. Keep track of seasons, movies, OAVs, specials, and more using manual entry or a faster **automatic mode** powered by a predefined local database. Designed for Windows.

---

## 🖼️ Preview

**(👇 Click to expand!)**

<details>
  <summary><strong>✨ Main Interface & Manual Add/Update Demo</strong></summary>
  <br/>
  <p align="center">
    <em>Main view displaying your anime list cards:</em><br/>
    <img src="https://cdn.discordapp.com/attachments/1037490342062207046/1364827093304606761/image.png?ex=680b15c8&is=6809c448&hm=06eab200811c2df5e3ec683c68cbe56a1996cd0d308be6267525da9a13284280&" alt="Main Menu Image" width="750">
    <br/><br/>
    <em>Demonstration: Manually adding an anime, changing status, and updating progress:</em><br/>
    <img src="https://cdn.discordapp.com/attachments/1037490342062207046/1364830358457155634/FirstGif-ezgif.com-video-to-gif-converter.gif?ex=680b18d2&is=6809c752&hm=9047294daf2fe56736834dfdb5e24b141f5c7a892ac07c52478f5b8841ba2660&" alt="GIF showing manual adding anime and updating episodes">
  </p>
</details>

<details>
  <summary><strong>🚀 Automatic Add Demo & More Features</strong></summary>
  <br/>
  <p align="center">
    <em>Demonstration: Using the Automatic Add feature (Select Title -> Select Entries -> Confirm):</em><br/>
    <!-- TODO: Add GIF/Image for Automatic Add -->
    <img src="[PLACEHOLDER_URL_FOR_AUTO_ADD_DEMO]" alt="GIF showing automatic anime adding workflow" width="750">
    <br/><br/>
    <em>Filtering by "Completed" Status and "OAV" Type:</em><br/>
    <img src="https://cdn.discordapp.com/attachments/1037490342062207046/1364892800088408104/secondgifRaliseavecClipchamp-ezgif.com-video-to-gif-converter.gif?ex=680b52fa&is=680a017a&hm=c23eec476a7e9cac7aad99942c8b938f9f48010cb5d598906e289412713f1b6c&" alt="Screenshot showing Filtering">
    <br/><br/>
    <em>Data Management: Export:</em><br/>
    <img src="https://cdn.discordapp.com/attachments/1037490342062207046/1364899529262108692/VidosanstitreRaliseavecClipchamp1-ezgif.com-video-to-gif-converter.gif?ex=680b593e&is=680a07be&hm=625e98caae5b0c284e4864ad4cf2b1a2ffcdd61a58ebe602ac1f4bee44efc3a1&" alt="Screenshot showing Data Management Export">
    <br/><br/>
    <em>Data Management: Clear Data Confirmation:</em><br/>
    <img src="https://cdn.discordapp.com/attachments/1037490342062207046/1364899528846606418/VidosanstitreRaliseavecClipchamp1-ezgif.com-speed.gif?ex=680b593e&is=680a07be&hm=81aaf70e10627ee8abe23eb30e6d1f4cbbd4830421eaa74ec5dc1854749f5071&" alt="Screenshot showing Data Management Clear">
    <br/><br/>
    <em>Data Management: Import Options:</em><br/>
    <img src="https://cdn.discordapp.com/attachments/1037490342062207046/1364899528439762944/VidosanstitreRaliseavecClipchamp1-ezgif.com-speed_1.gif?ex=680b593e&is=680a07be&hm=024aa5d26691fc8c6f49152a1944037249f544da59d3c8a6dfa7d134997ee300&" alt="Screenshot showing Data Management Import">
    <br/><br/>
    <em>Language Selection Dropdown:</em><br/>
    <img src="https://cdn.discordapp.com/attachments/1037490342062207046/1364902570174189608/VidosanstitreRaliseavecClipchamp2-ezgif.com-video-to-gif-converter.gif?ex=680b5c13&is=680a0a93&hm=36bf35ae28d96a5e27b00bcf23232a13d017f2cae7d2417777f9f43e6c8d5741&" alt="Screenshot showing Language Selection">
     <br/><br/>
    <em>Details Popup View:</em><br/>
    <img src="https://cdn.discordapp.com/attachments/1037490342062207046/1364902569650032710/VidosanstitreRaliseavecClipchamp3-ezgif.com-video-to-gif-converter.gif?ex=680b5c13&is=680a0a93&hm=30450460cafd7244abc20564ddbeb767e5ba62d5d6415e9f1b1bc0f86be1998a&" alt="Screenshot showing Details Popup">

  </div>
</details>

---

## ✨ Features Checklist

-   [x] ✨ **Manual Addition:** Add anime quickly (Title, Type, Number, Episodes).
-   [x] 🚀 **Automatic Addition:** Quickly add predefined anime entries (Seasons, Movies, OAVs etc.) from a local database.
-   [x] 🎨 **Automatic Cover Art:** Fetches cover art from Jikan API for manually added entries. (Automatic mode uses predefined images).
-   [x] 🖼️ **Custom Cover Art:** Option to use your own image URL (Manual Add).
-   [x] 📊 **Status Tracking:** Set status (Watching, Completed, etc.) via card dropdowns.
-   [x] 🔢 **Progress Tracking:** Use `+`/`-` for episode counts (Series/OAVs) or toggle Watched (Movies).
-   [x] ℹ️ **Detailed View:** Popup with full details per anime (allows editing watched/total episodes).
-   [x] 🔍 **Filtering:** Sidebar filters for **Status** (buttons) and **Type** (dropdown).
-   [x] 🌐 **Multi-language:** Supports 20 languages via sidebar dropdown.
-   [x] 💾 **Data Management:** Import/Export (`.json`) & Clear Data options.
-   [x] 🔒 **Offline First:** Uses `electron-store` for local data storage. Predefined data is also local.
-   [x] 🔄 **Automatic Updates:** Checks for new versions on GitHub Releases and prompts for installation.

---

## 🎯 Why Choose Anime List?

> Simple, Fast, Private Anime Tracking.

*   ✅ **Focus:** Tracks only what matters without website bloat.
*   ⚡ **Speed:** Instant updates and list viewing - no waiting for web pages. **Automatic add** significantly speeds up adding large series.
*   🏠 **Privacy:** Your list lives entirely on your computer.
*   🔌 **Offline Access:** Use it anywhere, anytime (images need initial fetch for manual entries).

### 🚀 Speed Comparison

Because Anime List runs locally, common actions are significantly faster than waiting for website interactions:

| Action                   | Anime List (Local) 🏠     | Typical Website ☁️        |
| :----------------------- | :------------------------ | :-------------------------- |
| Add Entry (Manual)       | Instant Save ✅           | Page Load + Form + Submit⏳|
| Add Entry (Automatic)    | Select + Instant Save ✅✅ | N/A (Requires manual entry) |
| Update Status            | Instant Save ✅           | Page Load + Click + Reload⏳ |
| Update Episode           | Instant Save ✅           | Page Load + Click + Reload⏳ |
| View List                | Instant Load ✅           | Page Load + API Calls ⏳    |
| Filter List              | Instant UI Update ✅      | Page Reload / API Call ⏳   |

*(Speed benefits are most noticeable for frequent updates, viewing, and adding entries via automatic mode).*

---

## 🛠️ Built With

*   💻 **[Electron](https://www.electronjs.org/) (v26.6.10)**: Desktop app framework.
*   🔩 **[Electron Forge](https://www.electronforge.io/) (v7.8.0)**: Build & packaging tools.
*   🦴 **HTML**: Content structure.
*   🎨 **CSS**: Styling, animations, themes.
*   💡 **JavaScript (Node.js)**: App logic & interactions.

---

## 📦 Key Dependencies

*   **`electron` (v26.6.10)**: (Dev Dependency) Core framework.
*   **`@electron-forge/cli` (v7.8.0)**: (Dev Dependency) Build tools.
*   **`electron-store` (v7.0.3)**: Local data persistence.
*   **`sweetalert2` (v11.4.8)**: Pop-up dialogs.
*   *(Uses Electron's built-in `net` module for API requests in manual add)*
*   *(Uses Electron's built-in `autoUpdater` module for updates)*

---

## 🚀 Getting Started (Windows Only)

1.  Go to the **[Releases Page](https://github.com/iamplayerexe/animelist/releases)**.
2.  Download the latest `.exe` setup file from the **Assets** section.
3.  Run the installer.
4.  Launch **Anime List**! Updates will be checked automatically on launch.

---

## 📖 How to Use

1.  🖱️ **Launch:** Open the app.
2.  ➕ **Add Anime:** Click **`+`** (navbar). You'll be prompted to choose:
    *   **Automatic:**
        1.  Select the main anime title from the grid.
        2.  Select the specific seasons, movies, OAVs, etc., you want to add. Use "Select All" / "Deselect All" for convenience.
        3.  Click **"Add Selected Entry (#)"**.
    *   **Manual:**
        1.  Fill in the details in the popup (Title, Type, Number, Episodes, optional Image URL).
        2.  *Tip:* Only **Title** and **Type** are always required. Number is needed for 'Season'. Episodes autofills for 'Movie'.
        3.  Click **"Add"**.
3.  📝 **Manage Cards:**
    *   *Status:* Use the **dropdown** on the card.
    *   *Progress:* Use **`+`**/**`-`** buttons (handles episodes or movie watched status). Click the watched number to edit manually (non-Movie types).
    *   *Details:* Click the **"Details"** button (also allows editing watched/total episodes).
    *   *Delete:* Click **"Details"** -> **"Delete"** -> Confirm.
4.  📊 **Filter List:**
    *   *Toggle Sidebar:* Click **☰** button.
    *   *Filter:* Click **Status buttons** or select from **Type dropdown**. Filters combine.
    *   *Clear:* Select **"All"** (Status) and **"All Types"** (Type).
5.  ⚙️ **Data & Settings:**
    *   Click **"Data"** button in the sidebar.
    *   *Import/Export:* Use the respective buttons. Choose Overwrite/Merge for import.
    *   *Clear:* Click **"Delete all data"** (⚠️ IRREVERSIBLE!).
    *   *Language:* Use the **language dropdown** at the bottom of the sidebar.
    *   *Back to Cards:* Click any **Status button** or select a **Type**.

---

## 🤝 Contributing

Contributions are welcome! Found a bug or have an idea? Open an issue here:
➡️ [**Issues Page**](https://github.com/iamplayerexe/animelist/issues)

Want to contribute code? (Requires Node.js & npm)

1.  **Fork** the repository.
2.  **Clone** your fork locally (`git clone ...`).
3.  **Install Dependencies** (`cd animelist && npm install`).
4.  **Create Branch** (`git checkout -b feature/YourUpdate`).
5.  **Make Changes**.
6.  **Test Locally** (`npm start`).
7.  **Commit** (`git commit -m 'feat: Describe your feature'`).
8.  **Push** (`git push origin feature/YourUpdate`).
9.  **Open Pull Request** back to `iamplayerexe/animelist`.

---

## 📜 License

This project is distributed under the **MIT License**.
See `LICENSE` file for more information.
<!-- <-- end comment (.md file)(README.md) -->