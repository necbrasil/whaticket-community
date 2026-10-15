// Pure parser for WhatsApp-style text formatting. Returns a list of nodes:
//   string | { type: "bold" | "italic" | "strike", children: Node[] }
//          | { type: "code" | "mono", text: string }
//          | { type: "link", text: string, href: string }
//          | { type: "mention", text: string }   (text includes the "@")

const MARKERS = { "*": "bold", _: "italic", "~": "strike" };
const URL_REGEX = /^(?:https?:\/\/|www\.)[^\s]+/i;
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/;
const ALNUM = /[\p{L}\p{N}]/u;
const SPACE = /\s/;
// unresolved mentions stay as "@<number>"
const MENTION_NUMBER = /^@\d{5,}/;

const isAlnum = ch => ch !== undefined && ALNUM.test(ch);
const isSpace = ch => ch !== undefined && SPACE.test(ch);

const findClosing = (text, from, marker) => {
	for (let j = from; j < text.length; j++) {
		const ch = text[j];
		if (ch === "\n") return -1;
		if (
			ch === marker &&
			j > from &&
			!isSpace(text[j - 1]) &&
			!isAlnum(text[j + 1])
		) {
			return j;
		}
	}
	return -1;
};

const matchMention = (text, i, names) => {
	for (const name of names) {
		const end = i + 1 + name.length;
		if (text.startsWith(name, i + 1) && !isAlnum(text[end])) {
			return `@${name}`;
		}
	}
	const number = MENTION_NUMBER.exec(text.slice(i));
	if (number && !isAlnum(text[i + number[0].length])) return number[0];
	return null;
};

// mentions: names shown for the people tagged in the message (optional)
const parseWhatsAppText = (text, mentions) => {
	const nodes = [];
	const names = (mentions || [])
		.filter(name => typeof name === "string" && name)
		.sort((a, b) => b.length - a.length);
	let buffer = "";

	const flush = () => {
		if (buffer) nodes.push(buffer);
		buffer = "";
	};

	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		const prev = text[i - 1];

		if (text.startsWith("```", i)) {
			const end = text.indexOf("```", i + 3);
			if (end > i + 3) {
				flush();
				nodes.push({ type: "mono", text: text.slice(i + 3, end) });
				i = end + 3;
				continue;
			}
		}

		if (ch === "`") {
			const end = text.indexOf("`", i + 1);
			const nl = text.indexOf("\n", i + 1);
			if (end > i + 1 && (nl === -1 || end < nl)) {
				flush();
				nodes.push({ type: "code", text: text.slice(i + 1, end) });
				i = end + 1;
				continue;
			}
		}

		if ((ch === "h" || ch === "H" || ch === "w" || ch === "W") && !isAlnum(prev)) {
			const match = URL_REGEX.exec(text.slice(i));
			if (match) {
				const url = match[0].replace(TRAILING_PUNCT, "");
				if (url.length > 0) {
					flush();
					nodes.push({
						type: "link",
						text: url,
						href: /^www\./i.test(url) ? `http://${url}` : url,
					});
					i += url.length;
					continue;
				}
			}
		}

		if (ch === "@" && !isAlnum(prev)) {
			const mention = matchMention(text, i, names);
			if (mention) {
				flush();
				nodes.push({ type: "mention", text: mention });
				i += mention.length;
				continue;
			}
		}

		const type = MARKERS[ch];
		if (
			type &&
			!isAlnum(prev) &&
			text[i + 1] !== undefined &&
			!isSpace(text[i + 1]) &&
			text[i + 1] !== ch
		) {
			const end = findClosing(text, i + 1, ch);
			if (end !== -1) {
				flush();
				nodes.push({
					type,
					children: parseWhatsAppText(text.slice(i + 1, end), mentions),
				});
				i = end + 1;
				continue;
			}
		}

		buffer += ch;
		i++;
	}

	flush();
	return nodes;
};

export default parseWhatsAppText;
