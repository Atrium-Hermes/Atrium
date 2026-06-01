// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/AtriumRegistry.sol";
import "../contracts/MockUSDC.sol";

/// @notice Testnet deploy: a MockUSDC (with faucet) + an AtriumRegistry pointed at it.
contract DeployMock is Script {
    function run() external returns (MockUSDC usdc, AtriumRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envOr("ATRIUM_TREASURY", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);
        usdc = new MockUSDC();
        registry = new AtriumRegistry(address(usdc), treasury);
        vm.stopBroadcast();

        console2.log("Deployer:        ", vm.addr(deployerKey));
        console2.log("MockUSDC:        ", address(usdc));
        console2.log("AtriumRegistry:  ", address(registry));
        console2.log("Treasury:        ", treasury);
    }
}
