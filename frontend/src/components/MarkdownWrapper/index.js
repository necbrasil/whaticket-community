import React from "react";

import parseWhatsAppText from "./parseWhatsAppText";

const CustomLink = ({ children, ...props }) => (
	<a {...props} target="_blank" rel="noopener noreferrer">
		{children}
	</a>
);

const monoStyle = { fontFamily: "Menlo, Consolas, 'Courier New', monospace" };

const renderNodes = (nodes, mentionColor) =>
	nodes.map((node, index) => {
		if (typeof node === "string") return node;

		switch (node.type) {
			case "bold":
				return <strong key={index}>{renderNodes(node.children, mentionColor)}</strong>;
			case "italic":
				return <em key={index}>{renderNodes(node.children, mentionColor)}</em>;
			case "strike":
				return <del key={index}>{renderNodes(node.children, mentionColor)}</del>;
			case "code":
			case "mono":
				return (
					<code key={index} style={monoStyle}>
						{node.text}
					</code>
				);
			case "mention":
				return (
					<span
						key={index}
						style={{
							color: mentionColor || "#027eb5",
							fontWeight: 500,
							textDecoration: "none",
							cursor: "default",
						}}
					>
						{node.text}
					</span>
				);
			case "link":
				return (
					<CustomLink key={index} href={node.href}>
						{node.text}
					</CustomLink>
				);
			default:
				return null;
		}
	});

const MarkdownWrapper = ({ children, mentions, mentionColor }) => {
	if (children === null || children === undefined) return null;

	const text = String(children).replace(/\r\n?/g, "\n");

	if (!text) return null;
	if (text.includes("BEGIN:VCARD")) return null;
	if (text.includes("data:image/")) return null;

	return <>{renderNodes(parseWhatsAppText(text, mentions), mentionColor)}</>;
};

export default MarkdownWrapper;
