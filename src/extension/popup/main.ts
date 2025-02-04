import { Popup } from "~/popup/popup";

import "../assets/common.css";
import "./popup.css";

(function () {
  console.log("popup loaded");
  
  const popup = new Popup();

  void popup.init();
})();
