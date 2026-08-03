<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![ISC License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <h3 align="center">Schedule Reminder Bot</h3>

  <p align="center">
    A powerful and customizable Discord Bot built to manage and remind you of your schedules!
    <br />
    <br />
    <a href="https://github.com/FahrizaSalam/Schedule-Reminder/issues">Report Bug</a>
    ·
    <a href="https://github.com/FahrizaSalam/Schedule-Reminder/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#commands">Commands</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

Schedule Reminder Bot is a Discord application designed to help communities, students, and teams stay on top of their tasks. With a built-in MySQL database and cron job integration, it accurately reminds designated roles or channels about upcoming schedules.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![Node][Node.js]][Node-url]
* [![Discord][Discord.js]][Discord-url]
* [![MySQL][MySQL.com]][MySQL-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

To get a local copy up and running follow these simple steps.

### Prerequisites

* Node.js (v16.9.0 or higher recommended)
* MySQL Server
* npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Create a Discord Bot on the [Discord Developer Portal](https://discord.com/developers/applications) and grab your token and client ID.
2. Clone the repo
   ```sh
   git clone https://github.com/FahrizaSalam/Schedule-Reminder.git
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
4. Create a `.env` file in the root directory and enter your variables:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CLIENT_ID=your_discord_client_id
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_db_password
   DB_NAME=schedule_reminder_db
   ```
5. Ensure your MySQL server is running and create the database referenced in your `.env`.
6. Start the bot!
   ```sh
   npm start
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

Once the bot is invited to your server and running, it will register its slash commands automatically. Use the slash commands to interact with the bot. 

For example, use `/setchannel` to define where reminders should be sent, and `/new` to create a new schedule.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- COMMANDS -->
## Commands

Here is a list of available slash commands:

- `/new` - Create a new schedule.
- `/addschedule` - Add an entry to a schedule.
- `/edit` - Edit an existing schedule.
- `/remove` - Remove a schedule or entry.
- `/list` - List all your active schedules.
- `/setchannel` - Set the channel where the bot will send reminders.
- `/setrole` - Set the role that the bot will ping for reminders.
- `/repeat` - Configure repeating schedules.
- `/help` - Display the help menu.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Basic slash commands support
- [x] MySQL database integration
- [x] Cron-based reminders
- [ ] Multi-server support enhancements
- [ ] Web dashboard for managing schedules

See the [open issues](https://github.com/FahrizaSalam/Schedule-Reminder/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the ISC License. See `package.json` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Zeehza - [GitHub Profile](https://github.com/FahrizaSalam)

Project Link: [https://github.com/FahrizaSalam/Schedule-Reminder](https://github.com/FahrizaSalam/Schedule-Reminder)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/FahrizaSalam/Schedule-Reminder.svg?style=for-the-badge
[contributors-url]: https://github.com/FahrizaSalam/Schedule-Reminder/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/FahrizaSalam/Schedule-Reminder.svg?style=for-the-badge
[forks-url]: https://github.com/FahrizaSalam/Schedule-Reminder/network/members
[stars-shield]: https://img.shields.io/github/stars/FahrizaSalam/Schedule-Reminder.svg?style=for-the-badge
[stars-url]: https://github.com/FahrizaSalam/Schedule-Reminder/stargazers
[issues-shield]: https://img.shields.io/github/issues/FahrizaSalam/Schedule-Reminder.svg?style=for-the-badge
[issues-url]: https://github.com/FahrizaSalam/Schedule-Reminder/issues
[license-shield]: https://img.shields.io/github/license/FahrizaSalam/Schedule-Reminder.svg?style=for-the-badge
[license-url]: https://github.com/FahrizaSalam/Schedule-Reminder/blob/master/package.json
[Node.js]: https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white
[Node-url]: https://nodejs.org/
[Discord.js]: https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white
[Discord-url]: https://discord.js.org/
[MySQL.com]: https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white
[MySQL-url]: https://www.mysql.com/
