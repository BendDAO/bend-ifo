import rawBRE from 'hardhat';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';

import {
  deployBendCompetitionTest,
  deployCryptoPunksMarket,
  deployMintableERC20,
  deployMintableERC721,
  deployTreasury,
  deployVeBend,
  deployWETHGateway,
} from '../helpers/contracts-deployments';
import { DRE, increaseTime, waitForTx } from '../helpers/misc-utils';
import {
  BendCompetition,
  CryptoPunksMarket,
  MintableERC20,
  MintableERC721,
} from '../types';
import {
  getEthersSigners,
  getSecondSigner,
} from '../helpers/contracts-getters';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../helpers/constants';

enum Stage {
  Prepare,
  Sale,
  Finish,
}

describe('Competition', async () => {
  const oneBend = new BigNumber(1).shiftedBy(18);
  const oneETH = new BigNumber(1).shiftedBy(18);
  const twoWeeks = 14 * 24 * 60 * 60;

  before(async () => {
    BigNumber.config({
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: BigNumber.ROUND_DOWN,
    });

    await rawBRE.run('set-DRE');
  });

  it('everyone can claim in Sale stage', async () => {
    const [firstSigner, secondSigner, teamSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const veBend = await deployVeBend([bendToken.address]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        TEAM_WALLET_ADDRESS: await teamSigner.getAddress(),
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
        VEBEND_ADDRESS: veBend.address,
        VEBEND_LOCK_MIN_PERIOD: twoWeeks,
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    expect(await bendCompetition.stage()).to.be.eq(Stage.Sale);

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(0.1).toFixed(0) })
    ).to.changeEtherBalances(
      [bendCompetition, secondSigner, veBend],
      [
        oneETH.multipliedBy(0.1).toFixed(0),
        oneETH.multipliedBy(-0.1).toFixed(0),
        oneETH.multipliedBy(0).toFixed(0),
      ]
    );

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(0.1).toFixed(0) })
    ).to.changeTokenBalances(
      bendToken,
      [bendCompetition, secondSigner, veBend],
      [
        oneETH.multipliedBy(-0.05).toFixed(0),
        oneETH.multipliedBy(0).toFixed(0),
        oneETH.multipliedBy(0.05).toFixed(0),
      ]
    );
  });

  it('should not cliam in Finish stage', async () => {
    const [firstSigner, secondSigner, teamSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const veBend = await deployVeBend([bendToken.address]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        TEAM_WALLET_ADDRESS: await teamSigner.getAddress(),
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
        VEBEND_ADDRESS: veBend.address,
        VEBEND_LOCK_MIN_PERIOD: twoWeeks,
      },
    ]);

    await increaseTime(twoWeeks);

    expect(await bendCompetition.stage()).to.be.eq(Stage.Finish);
    await expect(
      bendCompetition.connect(secondSigner).claim(twoWeeks, {})
    ).to.be.revertedWith('not in sale');
  });

  it('should lock at least VEBEND_LOCK_MIN_PERIOD', async () => {
    const [firstSigner, secondSigner, teamSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const veBend = await deployVeBend([bendToken.address]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        TEAM_WALLET_ADDRESS: await teamSigner.getAddress(),
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
        VEBEND_ADDRESS: veBend.address,
        VEBEND_LOCK_MIN_PERIOD: twoWeeks,
      },
    ]);

    await expect(
      bendCompetition
        .connect(secondSigner)
        .claim(new BigNumber(twoWeeks).minus(1).toFixed(0), {})
    ).to.be.revertedWith('lock period too short');
  });

  it('should claim only MAX_ETH_PAYMENT_PER_ADDR', async () => {
    const [firstSigner, secondSigner, teamSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const veBend = await deployVeBend([bendToken.address]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        TEAM_WALLET_ADDRESS: await teamSigner.getAddress(),
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
        VEBEND_ADDRESS: veBend.address,
        VEBEND_LOCK_MIN_PERIOD: twoWeeks,
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(10).toFixed(0) })
    ).to.changeEtherBalances(
      [bendCompetition, secondSigner],
      [oneETH.multipliedBy(1).toFixed(0), oneETH.multipliedBy(-1).toFixed(0)]
    );
  });

  it('should reward only MAX_ETH_PAYMENT_PER_ADDR * BEND_TOKEN_REWARD_PER_ETH', async () => {
    const [firstSigner, secondSigner, teamSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const veBend = await deployVeBend([bendToken.address]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        TEAM_WALLET_ADDRESS: await teamSigner.getAddress(),
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
        VEBEND_ADDRESS: veBend.address,
        VEBEND_LOCK_MIN_PERIOD: twoWeeks,
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(10).toFixed(0) })
    ).to.changeTokenBalances(
      bendToken,
      [bendCompetition, secondSigner, veBend],
      [
        oneETH.multipliedBy(-0.5).toFixed(0),
        oneETH.multipliedBy(0).toFixed(0),
        oneETH.multipliedBy(0.5).toFixed(0),
      ]
    );
  });

  it('should draw dividend', async () => {
    const [firstSigner, secondSigner, teamSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const veBend = await deployVeBend([bendToken.address]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        TEAM_WALLET_ADDRESS: await teamSigner.getAddress(),
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
        BEND_TOKEN_REWARD_PER_ETH: oneBend.div(2).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.toFixed(0),
        VEBEND_ADDRESS: veBend.address,
        VEBEND_LOCK_MIN_PERIOD: twoWeeks,
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(0).toFixed(0)
    );
    await waitForTx(
      await bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(0.1).toFixed(0) })
    );
    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(0.1).toFixed(0)
    );

    await expect(() => bendCompetition.drawDividend()).to.changeEtherBalances(
      [bendCompetition, teamSigner],
      [
        oneETH.multipliedBy(-0.1).toFixed(0),
        oneETH.multipliedBy(0.1).toFixed(0),
      ]
    );

    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(0).toFixed(0)
    );
  });

  it('should auto draw dividend', async () => {
    const [firstSigner, secondSigner, teamSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const veBend = await deployVeBend([bendToken.address]);

    const bendCompetition = await deployBendCompetitionTest([
      {
        TEAM_WALLET_ADDRESS: await teamSigner.getAddress(),
        BEND_TOKEN_ADDRESS: bendToken.address,
        AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(5).toFixed(0),
        BEND_TOKEN_REWARD_PER_ETH: oneBend.multipliedBy(0.001).toFixed(0),
        MAX_ETH_PAYMENT_PER_ADDR: oneETH.multipliedBy(1000).toFixed(0),
        VEBEND_ADDRESS: veBend.address,
        VEBEND_LOCK_MIN_PERIOD: twoWeeks,
      },
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(0).toFixed(0)
    );
    await waitForTx(
      await bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(1).toFixed(0) })
    );
    expect(await bendCompetition.remainDivident()).to.be.eq(
      oneETH.multipliedBy(1).toFixed(0)
    );

    await expect(() =>
      bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(4).toFixed(0) })
    ).to.changeEtherBalances(
      [secondSigner, bendCompetition, teamSigner],
      [
        oneETH.multipliedBy(-4).toFixed(0),
        oneETH.multipliedBy(-1).toFixed(0),
        oneETH.multipliedBy(5).toFixed(0),
      ]
    );
  });

  it('should print ui data', async () => {
    const [firstSigner, secondSigner, teamSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const veBend = await deployVeBend([bendToken.address]);

    const config = {
      TEAM_WALLET_ADDRESS: await teamSigner.getAddress(),
      BEND_TOKEN_ADDRESS: bendToken.address,
      AUTO_DRAW_DIVIDEND_THRESHOLD: oneETH.multipliedBy(100).toFixed(0),
      BEND_TOKEN_REWARD_PER_ETH: oneBend.multipliedBy(333333).toFixed(0),
      MAX_ETH_PAYMENT_PER_ADDR: oneETH.multipliedBy(2).toFixed(0),
      VEBEND_ADDRESS: veBend.address,
      VEBEND_LOCK_MIN_PERIOD: twoWeeks,
    };

    const bendCompetition = await deployBendCompetitionTest([config]);

    const bendBalance = oneBend.multipliedBy(10000000);
    await waitForTx(await bendToken.mint(bendBalance.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, bendBalance.toFixed(0))
    );

    let uiData = await bendCompetition.connect(secondSigner).uiData();

    const bendPrice = oneETH
      .shiftedBy(18)
      .div(config.BEND_TOKEN_REWARD_PER_ETH)
      .toFixed(0);

    expect([
      uiData.remainDivident.toString(),
      uiData.bendClaimedTotal.toString(),
      uiData.bendPrice.toString(),
      uiData.remainBendBalance.toString(),
      uiData.stage,
      uiData.bendBalance.toString(),
      uiData.veBendLockedBalanceAmount.toString(),
      uiData.maxETHPayment.toString(),
      uiData.maxBendReward.toString(),
    ]).to.be.deep.eq([
      '0',
      '0',
      bendPrice,
      bendBalance.toFixed(0),
      Stage.Sale,
      '0',
      '0',
      new BigNumber(config.MAX_ETH_PAYMENT_PER_ADDR).toFixed(0),
      new BigNumber(config.BEND_TOKEN_REWARD_PER_ETH)
        .multipliedBy(config.MAX_ETH_PAYMENT_PER_ADDR)
        .shiftedBy(-18)
        .toFixed(0),
    ]);

    await waitForTx(
      await bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(0.1).toFixed(0) })
    );

    uiData = await bendCompetition.connect(secondSigner).uiData();
    expect([
      uiData.remainDivident.toString(),
      uiData.bendClaimedTotal.toString(),
      uiData.bendPrice.toString(),
      uiData.remainBendBalance.toString(),
      uiData.stage,
      uiData.bendBalance.toString(),
      uiData.veBendLockedBalanceAmount.toString(),
      uiData.maxETHPayment.toString(),
      uiData.maxBendReward.toString(),
    ]).to.be.deep.eq([
      oneETH.multipliedBy(0.1).toFixed(0),
      new BigNumber(config.BEND_TOKEN_REWARD_PER_ETH)
        .multipliedBy(0.1)
        .toFixed(0),
      bendPrice,
      bendBalance
        .minus(
          new BigNumber(config.BEND_TOKEN_REWARD_PER_ETH).multipliedBy(0.1)
        )
        .toFixed(0),
      Stage.Sale,
      oneBend.multipliedBy(0).toFixed(0),
      new BigNumber(config.BEND_TOKEN_REWARD_PER_ETH)
        .multipliedBy(0.1)
        .toFixed(0),
      new BigNumber(config.MAX_ETH_PAYMENT_PER_ADDR)
        .minus(oneETH.multipliedBy(0.1))
        .toFixed(0),
      new BigNumber(config.MAX_ETH_PAYMENT_PER_ADDR)
        .minus(oneETH.multipliedBy(0.1))
        .multipliedBy(config.BEND_TOKEN_REWARD_PER_ETH)
        .shiftedBy(-18)
        .toFixed(0),
    ]);

    await waitForTx(
      await bendCompetition
        .connect(secondSigner)
        .claim(twoWeeks, { value: oneETH.multipliedBy(2).toFixed(0) })
    );

    uiData = await bendCompetition.connect(secondSigner).uiData();
    expect([
      uiData.remainDivident.toString(),
      uiData.bendClaimedTotal.toString(),
      uiData.bendPrice.toString(),
      uiData.remainBendBalance.toString(),
      uiData.stage,
      uiData.bendBalance.toString(),
      uiData.veBendLockedBalanceAmount.toString(),
      uiData.maxETHPayment.toString(),
      uiData.maxBendReward.toString(),
    ]).to.be.deep.eq([
      oneETH.multipliedBy(2).toFixed(0),
      new BigNumber(config.BEND_TOKEN_REWARD_PER_ETH)
        .multipliedBy(2)
        .toFixed(0),
      bendPrice,
      bendBalance
        .minus(new BigNumber(config.BEND_TOKEN_REWARD_PER_ETH).multipliedBy(2))
        .toFixed(0),
      Stage.Sale,
      oneBend.multipliedBy(0).toFixed(0),
      new BigNumber(config.BEND_TOKEN_REWARD_PER_ETH)
        .multipliedBy(2)
        .toFixed(0),
      oneETH.multipliedBy(0).toFixed(0),
      oneBend.multipliedBy(0).toFixed(0),
    ]);
  });
});
