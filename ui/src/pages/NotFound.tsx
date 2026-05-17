import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "12px",
        color: "rgba(255,255,255,0.78)",
        background: "#121212",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "56px", lineHeight: 1 }}>404</h1>
      <div style={{ opacity: 0.72 }}>页面不存在</div>
      <Link to="/" style={{ color: "#9ec1ff", textDecoration: "none" }}>
        返回首页
      </Link>
    </div>
  );
};

export default NotFound;
