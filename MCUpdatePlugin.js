import fetch from "node-fetch";

const VERSION_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest.json";
const NOTIFY_GROUP_ID = "123456";

export class MCUpdatePlugin extends plugin {
  constructor() {
    super({
      name: "MC更新提示",
      dsc: "自动检查并提示Minecraft版本更新",
      event: "message",
      priority: 1,
      rule: [
        {
          reg: "^#?mc版本$",
          fnc: "manualCheck",
        },
      ],
    });

    this.lastCheckedTime = null;
    this.initAutoCheck();

    this.task = {
      cron: "0 * * * * ?",
      name: "MC更新检测",
      fnc: () => this.autoCheck(),
    };
  }

  initAutoCheck() {
    logger.info("[MC更新检测] 启动检测服务");
    this.autoCheck();
  }

  async autoCheck() {
    logger.mark("[MC更新检测] 检测是否有新版本");
    try {
      const response = await fetch(VERSION_MANIFEST_URL);
      const data = await response.json();
      const versions = data.versions;

      if (!versions || versions.length === 0) {
        logger.error("[MC更新检测] 无法获取版本信息");
        return;
      }

      if (!this.lastCheckedTime) {
        this.lastCheckedTime = new Date(versions[0].releaseTime);
        logger.info("[MC更新检测] 初始化完成");
        return;
      }

      const newVersions = [];
      for (const version of versions) {
        const releaseTime = new Date(version.releaseTime);
        if (releaseTime > this.lastCheckedTime) {
          newVersions.push(version);
        } else {
          break;
        }
      }

      if (newVersions.length > 0) {
        let message = "Minecraft 发现新版本！\n";
        newVersions.forEach((v) => {
          message += `\n▸ 版本：${v.id}`;
          message += `\n▸ 类型：${v.type}`;
          message += `\n▸ 发布时间：${v.releaseTime}`;
          message += `\n▸ 更新日志：${this.getMinecraftUpdateLogUrl(v.type, v.id)}\n`;
        });

        await Bot.pickGroup(NOTIFY_GROUP_ID).sendMsg(message);
        logger.info(`[MC更新检测] 已发送新版本通知到群 ${NOTIFY_GROUP_ID}`);

        this.lastCheckedTime = new Date(versions[0].releaseTime);
      }
    } catch (error) {
      logger.error(`[MC更新检测] 自动检查错误: ${error.message}`);
    }

    return true;
  }

  getMinecraftUpdateLogUrl(type, version) {
    const Url = "https://www.minecraft.net/zh-hans/article";

    if (type === "release") {
      return `${Url}/minecraft-java-edition-${version.replace(/\./g, "-")}`;
    }

    if (type === "snapshot") {
      const preReleaseMatch = version.match(/^(\d+\.\d+\.\d+)-(rc|pre)(\d+)$/i);
      if (preReleaseMatch) {
        const [_, ver, type, num] = preReleaseMatch;
        const stage = type.toLowerCase() === "rc" ? "release-candidate" : "pre-release";
        return `${Url}/minecraft-${ver.replace(/\./g, "-")}-${stage}-${num}`;
      }

      if (/^\d{2}w\d{2}[a-z]$/i.test(version)) {
        return `${Url}/minecraft-snapshot-${version.toLowerCase()}`;
      }

      if (/^\d{2}w\d+/i.test(version)) {
        return `${Url}s`;
      }

      return `${Url}s`;
    }
  }

  async manualCheck(e) {
    try {
      const response = await fetch(VERSION_MANIFEST_URL);
      const data = await response.json();
      const latest = data.versions[0];

      let message = "Minecraft 最新版本信息\n";
      message += `▸ 版本：${latest.id}\n`;
      message += `▸ 类型：${latest.type}\n`;
      message += `▸ 发布时间：${latest.releaseTime}\n`;
      message += `▸ 更新日志：${this.getMinecraftUpdateLogUrl(latest.type, latest.id)}`;

      await e.reply(message);
    } catch (error) {
      await e.reply("检查更新失败，请稍后再试");
      logger.error(`[MC更新检测] 手动检查错误: ${error.message}`);
    }
  }
}
