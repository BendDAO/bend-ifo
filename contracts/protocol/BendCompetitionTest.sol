// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BendCompetition} from "./BendCompetition.sol";

contract BendCompetitionTest is BendCompetition {
    Config CONFIG;

    function initialize(Config memory config) external initializer {
        __Competition_init();
        CONFIG = config;
    }

    function getConfig() public view override returns (Config memory config) {
        return CONFIG;
    }
}
