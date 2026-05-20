import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "antd";
import { fetchLoginCaptcha, login } from "../utils/api";
import "./Login.css";

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const loadCaptcha = async () => {
    setLoadingCaptcha(true);
    try {
      const response = await fetchLoginCaptcha();
      if (response.success) {
        setCaptchaId(response.data.captchaId);
        setCaptchaImage(response.data.imageData);
      } else {
        message.error(response.errorMessage || "获取验证码失败");
      }
    } catch {
      message.error("获取验证码失败");
    } finally {
      setLoadingCaptcha(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needCaptcha && (!captchaId || !captchaAnswer.trim())) {
      message.warning("请输入验证码");
      return;
    }

    try {
      const response = await login(username, password, needCaptcha ? { captchaId, captchaAnswer } : undefined);
      if (response.success) {
        localStorage.setItem("_token", response.data.token);
        message.success("登录成功");
        navigate("/admin");
      } else {
        const nextNeedCaptcha = Boolean(response?.data?.needCaptcha);
        const locked = Boolean(response?.data?.locked);
        const retryAfter = Number(response?.data?.retryAfter || 0);

        if (nextNeedCaptcha) {
          setNeedCaptcha(true);
          setCaptchaAnswer("");
          await loadCaptcha();
        }

        if (locked && retryAfter > 0) {
          message.error(`已临时锁定，请在 ${retryAfter} 秒后重试`);
          return;
        }

        message.error(response.errorMessage || response.message || "登录失败");
      }
    } catch (error) {
      const errMsg = (error as any)?.response?.data?.errorMessage || "登录失败";
      message.error(errMsg);
      console.error("登录失败:", error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-panel">
        <div className="login-hero">
          <span className="login-badge">Fantetic Nav</span>
          <h1>管理入口</h1>
        </div>
        <div className="login-box">
          <h2>账号登录</h2>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                required
              />
            </div>
            <div className="input-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                required
              />
            </div>
            {needCaptcha && (
              <>
                <div className="captcha-row">
                  <img className="captcha-image" src={captchaImage} alt="验证码" />
                  <button
                    type="button"
                    className="captcha-refresh-btn"
                    onClick={loadCaptcha}
                    disabled={loadingCaptcha}
                  >
                    {loadingCaptcha ? "加载中..." : "换一张"}
                  </button>
                </div>
                <div className="input-group">
                  <input
                    type="text"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="请输入验证码答案"
                    required
                  />
                </div>
              </>
            )}
            <button type="submit" className="login-button">
              登录
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
