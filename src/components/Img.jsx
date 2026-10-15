import { useImgUrl } from "../lib/media";

// Igual que <img>, pero entiende las fotos subidas desde el admin ("m:ID").
export default function Img({ src, alt = "", ...rest }) {
  const url = useImgUrl(src);
  return <img src={url || undefined} alt={alt} decoding="async" {...rest} />;
}
