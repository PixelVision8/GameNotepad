import { createSignal, onCleanup, onMount } from "solid-js";

interface CustomWindow extends Window {
  GetURL?: () => string;
  LogToJavaScript?: (message: string) => void;
  createUnityInstance?: (canvas: HTMLCanvasElement, config: object) => Promise<any>;
}

declare let window: CustomWindow;

export const Game = () => {
  let canvas: HTMLCanvasElement;
  let gameContainer: HTMLDivElement;

  const [width, setWidth] = createSignal(0);
  const [height, setHeight] = createSignal(0);

  const scaleToFit = true; // replace with your actual value
  const r = 256 / 240;

  const onResize = () => {
    let w = 0;
    let h = 0;
  
    if (scaleToFit) {
      w = gameContainer.offsetWidth;
      h = gameContainer.offsetHeight;
  
      const r = 512 / 480; // Adjusted aspect ratio
  
      if (w / r > h) {
        w = Math.floor(h * r);
      } else {
        h = Math.floor(w / r);
      }
    }

    if (canvas && gameContainer) {
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.position = 'absolute';
      canvas.style.top = `${Math.floor((gameContainer.offsetHeight - h) / 2)}px`;
      canvas.style.left = `${Math.floor((gameContainer.offsetWidth - w) / 2)}px`;
    }

    setWidth(w);
    setHeight(h);
  };

  onCleanup(() => {
    window.removeEventListener('resize', onResize);
    delete window.GetURL;
  
    // Remove event listeners from the canvas
    // if (canvas) {
    //   canvas.removeEventListener('mousemove', mouseMoveHandler);
    //   canvas.removeEventListener('mousedown', mouseDownHandler);
    //   canvas.removeEventListener('mouseup', mouseUpHandler);
    //   // Add more lines here if you have other event listeners
    // }
  });
  

  window.addEventListener('resize', onResize);

  onMount(() => {

    // Define the GetURL function
    // window.GetURL = () => {
    //   return "/p64/StreamingAssets/game!!.pv8";
    // };
    // Define the LogToJavaScript function
    window.LogToJavaScript = (message) => {
      console.log("From Unity: " + message);
    };

    // Unity game configuration
    const config = {
      canvasId: "unity-canvas",
      dataUrl: "/UnityWebGL/Build/UnityWebGL.data.gz",
      frameworkUrl: "/UnityWebGL/Build/UnityWebGL.framework.js.gz",
      codeUrl: "/UnityWebGL/Build/UnityWebGL.wasm.gz",
      streamingAssetsUrl: "/UnityWebGL/StreamingAssets",
      companyName: "Pixel Vision 8",
      productName: "Pixel Vision 8 Unity Runner",
      productVersion: "1.0",
    };

    // Check if createUnityInstance is defined before calling it
    if (window.createUnityInstance) {
      window.createUnityInstance(canvas, config).then(function (instance) {
        canvas = instance.Module.canvas;
        onResize();
      });
    } else {
      console.error("window.createUnityInstance is not defined");
    }
  });

  return (
    <div ref={(el) => { gameContainer = el; }} style={{ position: 'relative', width: '100%', height: '100%', background: 'black' }}>
      <canvas
        id="unity-canvas"
        ref={(el) => { canvas = el; }}
        data-pixel-art="true"
        style={{ position: 'absolute' }}
      />
    </div>
  )
  
}
