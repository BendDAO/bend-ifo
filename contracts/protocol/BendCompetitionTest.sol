// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BendCompetition} from "./BendCompetition.sol";
import "hardhat/console.sol";

contract BendCompetitionTest is BendCompetition {
    Config CONFIG;

    constructor(Config memory config) BendCompetition() {
        CONFIG = config;
    }

    function getConfig() public view override returns (Config memory config) {
        console.log("BEND_TOKEN_ADDRESS", CONFIG.BEND_TOKEN_ADDRESS);
        return CONFIG;
    }
}
