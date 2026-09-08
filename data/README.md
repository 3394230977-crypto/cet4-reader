# 本地学习词典

`dictionary.json` 是随网站发布的 ECDICT 学习词典，共 8,870 个小写索引词条，约 1.04 MB。浏览器查词只请求本网站这个文件，无需等待 GitHub 或第三方 CDN。

数据来自 [ECDICT](https://github.com/skywind3000/ECDICT)，固定版本 [`bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b`](https://github.com/skywind3000/ECDICT/tree/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b)，按该仓库 [MIT 许可证](LICENSE-ECDICT.txt) 发布。原始版权声明为 `Copyright (c) 2025 Linwei`。数据整理和修订日期：2026-09-08。

## 收录和处理

- 收录源数据中带中考、高考、CET-4、CET-6 标记的英文词条。
- 补充 BNC 或当代词频排名前 6,000 的英文词条，以及常见不规则词形。
- 只读取中文释义字段；不把英文例句、词频、词形元数据拼接成定义。
- 去掉重复释义，保留多个义项，不把所有屈折变化强制归为同一个词。
- 原始音标字段主要为英音，因此填入 `ukphone`，`usphone` 留空。没有自行生成美音音标。
- `dictionary-overrides.json` 记录独立撰写的词条修订：区分 `axes` 的两个读音和三类词义；补全 `does`、`saw`、`left`、`studies` 的同形词；纠正 `drunk` 的过去分词说明；补充 `address` 的“处理问题”和 `issue` 的“议题、期刊一期”等阅读常用义。

这是学习用词汇子集，并非完整的 77 万词条 ECDICT 数据库，也不会自动认定某个义项就是当前句子的词义。义项需要结合完整句译判断。

## 可复现构建

需要 Node.js 18 或更新版本，无需安装依赖。在网站目录运行：

```sh
node scripts/build-dictionary.mjs
node scripts/build-dictionary.mjs --verify
```

默认从随项目保存的 `sources/ecdict-selected.json` 和修订文件重建词库。校验命令确认结果及元数据与已发布文件逐字一致。

从固定版本完整 CSV 重新筛选，使用：

```sh
node scripts/build-dictionary.mjs --download
```

也可以从 [完整源 CSV](https://raw.githubusercontent.com/skywind3000/ECDICT/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv) 下载后指定本地文件：

```sh
node scripts/build-dictionary.mjs --source /path/to/ecdict.csv
```

脚本先验证完整源文件 SHA-256，再按固定规则裁剪。完整 CSV 约 66 MB，只在维护时使用；浏览器不会下载它。源版本、完整源 SHA-256、子集 SHA-256、修订 SHA-256、最终产物 SHA-256 和字节数见 `dictionary.meta.json`。

## 抽查参考

修订文字是本项目撰写的简明学习说明；以下页面只用于核对语言事实，没有导入其例句或整篇释义：

- [Merriam-Webster：axes](https://www.merriam-webster.com/dictionary/axes)，确认 `axe` 与 `axis` 的复数同形。
- [Cambridge：drink](https://dictionary.cambridge.org/us/dictionary/english/drink)，确认过去式 `drank`、过去分词 `drunk`。
- [Cambridge：address](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/address)，确认动词“处理问题”义。

词典属于开放数据，可能仍包含旧式用语、领域术语或待修订条目；修改 `dictionary-overrides.json` 后重新构建即可留下明确修订记录。
