import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterModule", (m) => {
  const registry = m.contract("StudyMaterialRegistry");

  return { registry };
});
