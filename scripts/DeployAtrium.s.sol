// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/AtriumRegistry.sol";

contract DeployAtrium is Script {
    // USDC addresses
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external returns (AtriumRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envOr("ATRIUM_TREASURY", vm.addr(deployerKey));

        address usdc = block.chainid == 8453 ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;

        console2.log("Network:    chainId", block.chainid);
        console2.log("USDC:      ", usdc);
        console2.log("Treasury:  ", treasury);
        console2.log("Deployer:  ", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);
        registry = new AtriumRegistry(usdc, treasury);
        vm.stopBroadcast();

        console2.log("");
        console2.log("AtriumRegistry deployed at:", address(registry));
        console2.log("");
        console2.log("Add to ~/.atrium/.env:");
        if (block.chainid == 8453) {
            console2.log("  ATRIUM_REGISTRY_MAINNET=", address(registry));
        } else {
            console2.log("  ATRIUM_REGISTRY_SEPOLIA=", address(registry));
        }
    }
}
