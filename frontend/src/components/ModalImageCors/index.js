import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";
import ModalImage from "react-modal-image";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
	unavailable: {
		padding: "10px 12px",
		fontSize: 13,
		fontStyle: "italic",
		opacity: 0.7,
	},
	messageMedia: {
		objectFit: "cover",
		width: 250,
		height: 200,
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
	},
}));

const ModalImageCors = ({ imageUrl }) => {
	const classes = useStyles();
	const [fetching, setFetching] = useState(true);
	const [blobUrl, setBlobUrl] = useState("");
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!imageUrl) return;
		setFailed(false);
		let cancelled = false;
		const fetchImage = async () => {
			try {
				const { data, headers } = await api.get(imageUrl, {
					responseType: "blob",
				});
				if (cancelled) return;
				const url = window.URL.createObjectURL(
					new Blob([data], { type: headers["content-type"] })
				);
				setBlobUrl(url);
			} catch (err) {
				// falls back to the raw URL
				if (!cancelled) setBlobUrl("");
			}
			if (!cancelled) setFetching(false);
		};
		fetchImage();
		return () => {
			cancelled = true;
		};
	}, [imageUrl]);

	const src = fetching || !blobUrl ? imageUrl : blobUrl;

	useEffect(() => {
		if (fetching) return;
		const probe = new Image();
		probe.onerror = () => setFailed(true);
		probe.src = src;
	}, [fetching, src]);

	if (failed) {
		return (
			<div className={classes.unavailable}>
				{i18n.t("messagesList.photoUnavailable")}
			</div>
		);
	}

	return (
		<ModalImage
			className={classes.messageMedia}
			smallSrcSet={src}
			medium={src}
			large={src}
			alt="image"
		/>
	);
};

export default ModalImageCors;
