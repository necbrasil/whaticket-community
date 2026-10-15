import React from "react";

import parseWhatsAppText from "./parseWhatsAppText";

const CustomLink = ({ children, ...props }) => (
	<a {...props} target="_blank" rel="noopener noreferrer">
		{children}
	</a>
);

const monoStyle = { fontFamily: "Menlo, Consolas, 'Courier New', monospace" };

const renderNodes = nodes =>
	nodes.map((node, index) => {
		if (typeof node === "string") return node;

		switch (node.type) {
			case "bold":
				return <strong key={index}>{renderNodes(node.children)}</strong>;
			case "italic":
				return <em key={index}>{renderNodes(node.children)}</em>;
			case "strike":
				return <del key={index}>{renderNodes(node.children)}</del>;
			case "code":
			case "mono":
				return (
					<code key={index} style={monoStyle}>
						{node.text}
					</code>
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

const MarkdownWrapper = ({ children }) => {
	if (children === null || children === undefined) return null;

	const text = String(children).replace(/\r\n?/g, "\n");

	if (!text) return null;
	if (text.includes("BEGIN:VCARD")) return null;
	if (text.includes("data:image/")) return null;

	return <>{renderNodes(parseWhatsAppText(text))}</>;
};

export default MarkdownWrapper;
