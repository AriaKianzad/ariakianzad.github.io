"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type SignalSceneProps = {
  onReady?: () => void;
};

export default function SignalScene({ onReady }: SignalSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: window.devicePixelRatio <= 1.5,
        powerPreference: "low-power",
      });
    } catch {
      canvas.dataset.failed = "true";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x090d0c, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(0, 0, 7.2);

    const world = new THREE.Group();
    world.position.set(0.08, 0.02, 0);
    scene.add(world);

    const innerGlow = new THREE.PointLight(0xc8ed87, 22, 5.5, 2);
    innerGlow.position.set(0.1, 0.05, 1.2);
    world.add(innerGlow);

    const keyLight = new THREE.DirectionalLight(0xe0e8c9, 3.1);
    keyLight.position.set(3.5, 4, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8cae74, 2.2);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);

    scene.add(new THREE.AmbientLight(0x82917f, 0.72));

    const coreGeometry = new THREE.IcosahedronGeometry(0.92, 5);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x899a6f,
      metalness: 0.72,
      roughness: 0.2,
      clearcoat: 0.82,
      clearcoatRoughness: 0.18,
      emissive: 0x1b2914,
      emissiveIntensity: 0.28,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    world.add(core);

    const innerGeometry = new THREE.IcosahedronGeometry(0.51, 2);
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0x111915,
      metalness: 0.74,
      roughness: 0.22,
      wireframe: true,
    });
    const innerCore = new THREE.Mesh(innerGeometry, innerMaterial);
    innerCore.rotation.set(0.2, 0.34, 0.12);
    world.add(innerCore);

    const shellGeometry = new THREE.IcosahedronGeometry(1.12, 2);
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: 0xd0e5a3,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.rotation.set(0.22, -0.28, 0.14);
    world.add(shell);

    const ringMaterials = [
      new THREE.MeshBasicMaterial({ color: 0xc6df9b, transparent: true, opacity: 0.65 }),
      new THREE.MeshBasicMaterial({ color: 0xd9dfd0, transparent: true, opacity: 0.26 }),
      new THREE.MeshBasicMaterial({ color: 0x9cb984, transparent: true, opacity: 0.42 }),
    ];
    const rings = [
      new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.005, 6, 220), ringMaterials[0]),
      new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.004, 6, 220), ringMaterials[1]),
      new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.003, 6, 220), ringMaterials[2]),
    ];
    rings[0].rotation.set(0.96, 0.22, -0.35);
    rings[1].rotation.set(0.35, 1.05, 0.16);
    rings[2].rotation.set(1.42, -0.5, 0.82);
    rings.forEach((ring) => world.add(ring));

    const nodeGeometry = new THREE.SphereGeometry(0.035, 12, 12);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xd5e7ac });
    const nodePositions: THREE.Vector3[] = [];
    const nodeCount = 9;
    for (let index = 0; index < nodeCount; index += 1) {
      const angle = (index / nodeCount) * Math.PI * 2 + 0.18;
      const radius = index % 2 === 0 ? 1.52 : 1.82;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.72,
        (index % 3 - 1) * 0.26,
      );
      nodePositions.push(position);
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.position.copy(position);
      world.add(node);
    }

    const connectorPositions: number[] = [];
    for (let index = 0; index < nodePositions.length; index += 1) {
      const current = nodePositions[index];
      const next = nodePositions[(index + 1) % nodePositions.length];
      connectorPositions.push(
        current.x, current.y, current.z,
        next.x, next.y, next.z,
      );
    }
    const connectorGeometry = new THREE.BufferGeometry();
    connectorGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(connectorPositions, 3),
    );
    const connectorMaterial = new THREE.LineBasicMaterial({
      color: 0xb6cb8d,
      transparent: true,
      opacity: 0.22,
    });
    const connectors = new THREE.LineSegments(connectorGeometry, connectorMaterial);
    world.add(connectors);

    const particlePositions: number[] = [];
    for (let index = 0; index < 240; index += 1) {
      const seed = index + 1;
      const angle = seed * 2.399963229728653;
      const vertical = ((seed * 0.61803398875) % 1) * 2 - 1;
      const spread = 2.25 + ((seed * 0.173) % 1) * 1.35;
      const horizontal = Math.sqrt(1 - vertical * vertical);
      particlePositions.push(
        Math.cos(angle) * horizontal * spread,
        vertical * spread,
        Math.sin(angle) * horizontal * spread * 0.55,
      );
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(particlePositions, 3),
    );
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xc5d0b6,
      size: 0.012,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    let pointerX = 0;
    let pointerY = 0;
    let frameId = 0;
    let lastTime = 0;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;

    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2;
      pointerY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2;
    };

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = width < 620 ? 8.1 : 7.2;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const animate = (time: number) => {
      frameId = 0;
      if (document.visibilityState === "hidden") return;

      const delta = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.04);
      lastTime = time;

      if (!reducedMotion) {
        world.rotation.y += delta * 0.095;
        world.rotation.x += delta * 0.026;
        world.rotation.z = THREE.MathUtils.lerp(world.rotation.z, pointerX * 0.08, 0.025);
        world.position.x = THREE.MathUtils.lerp(world.position.x, 0.08 + pointerX * 0.16, 0.025);
        world.position.y = THREE.MathUtils.lerp(
          world.position.y,
          0.02 - pointerY * 0.12 + Math.sin(time * 0.00036) * 0.035,
          0.025,
        );
        shell.rotation.y -= delta * 0.045;
        innerCore.rotation.y += delta * 0.12;
        rings[0].rotation.z += delta * 0.035;
        rings[1].rotation.x -= delta * 0.022;
        rings[2].rotation.y += delta * 0.028;
        particles.rotation.y -= delta * 0.006;
      }

      renderer.render(scene, camera);
      if (!reducedMotion) frameId = window.requestAnimationFrame(animate);
    };

    const start = () => {
      if (!reducedMotion && frameId === 0 && document.visibilityState === "visible") {
        lastTime = 0;
        frameId = window.requestAnimationFrame(animate);
      } else if (reducedMotion) {
        renderer.render(scene, camera);
      }
    };

    const stop = () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };

    const onMotionPreferenceChange = () => {
      reducedMotion = motionQuery.matches;
      if (reducedMotion) {
        stop();
        renderer.render(scene, camera);
      } else {
        start();
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionPreferenceChange);

    resize();
    onReady?.();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionPreferenceChange);

      coreGeometry.dispose();
      coreMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      shellGeometry.dispose();
      shellMaterial.dispose();
      rings.forEach((ring, index) => {
        ring.geometry.dispose();
        ringMaterials[index].dispose();
      });
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      connectorGeometry.dispose();
      connectorMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, [onReady]);

  return <canvas ref={canvasRef} className="signal-canvas" />;
}
